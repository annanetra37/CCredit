"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { hasValidCalibration } from "@/lib/domain/calibration";
import { hasValidEvidenceBasis } from "@/lib/domain/evidence";
import { DEFAULT_SOURCE_RANK } from "@/lib/domain/sources";
import {
  validateTransition,
  type AttrStatus,
} from "@/lib/domain/ledger/attribute-machine";

/** S7-3: track assignment — deliberate, recorded, write-once. */
export async function assignTrackAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schema = z.object({
    siteId: z.string().uuid(),
    outcome: z.enum(["CARBON_ELIGIBLE", "IREC_ONLY", "PENDING_REVIEW"]),
    assessorName: z.string().min(2),
    rationale: z.string().min(20, "A written rationale is required — this decision is effectively irreversible."),
    cohort: z.string().optional(),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/attributes?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const data = parsed.data;

  const db = getDb();

  // Track on the attribute is write-once; changing an existing assignment
  // requires an admin override that writes an audit record.
  const [existing] = await db
    .select()
    .from(tables.trackAssignments)
    .where(eq(tables.trackAssignments.siteId, data.siteId));
  if (existing && user.role !== "admin") {
    redirect(`/attributes?error=${encodeURIComponent("Track is already assigned for this site. Changing it requires an admin override.")}`);
  }

  await db.insert(tables.trackAssignments).values({
    siteId: data.siteId,
    outcome: data.outcome,
    assessorName: data.assessorName,
    assessedOn: new Date(),
    rationale: data.rationale,
    cohort: data.cohort,
  });

  // Propagate to unissued attributes of the site.
  const track = data.outcome === "CARBON_ELIGIBLE" ? "CARBON" : data.outcome === "IREC_ONLY" ? "IREC" : "UNASSIGNED";
  if (track !== "UNASSIGNED") {
    await db
      .update(tables.attributes)
      .set({ track })
      .where(and(eq(tables.attributes.siteId, data.siteId), eq(tables.attributes.track, "UNASSIGNED")));
  }

  await writeAudit({
    actorId: user.id,
    action: existing ? "track.override" : "track.assign",
    entityType: "site",
    entityId: data.siteId,
    before: existing ? { outcome: existing.outcome } : null,
    after: data,
  });

  redirect("/attributes");
}

/**
 * S7-2: attribute transition with the full guard set computed from the
 * database and enforced by the pure state machine.
 */
export async function transitionAttributeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const attributeId = z.string().uuid().parse(formData.get("attributeId"));
  const to = formData.get("to") as AttrStatus;

  const db = getDb();
  const [attr] = await db.select().from(tables.attributes).where(eq(tables.attributes.id, attributeId));
  if (!attr) redirect("/attributes");

  const [period] = await db.select().from(tables.periods).where(eq(tables.periods.id, attr.periodId));

  // Guard inputs for ALLOCATED (S7-2, revised by R1 §7): period reconciled,
  // contract valid across period, EVIDENCE BASIS valid across period
  // (data-release consent — or calibration where our own METER is promoted
  // to record of account), track assigned.
  let contractValid = false;
  let evidenceValid = false;
  if (period) {
    const contracts = await db
      .select()
      .from(tables.contracts)
      .where(and(eq(tables.contracts.siteId, attr.siteId), isNull(tables.contracts.supersededBy)));
    contractValid = contracts.some(
      (c) =>
        c.signedAt !== null &&
        c.validFrom <= period.startsOn &&
        (c.validTo === null || c.validTo >= period.endsOn),
    );

    const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, attr.siteId));
    const rank = { ...DEFAULT_SOURCE_RANK, ...(site?.sourceRank ?? {}) };
    const meterIsRecordOfAccount = rank.METER < rank.ENA_BILLING;

    if (meterIsRecordOfAccount) {
      const meters = await db
        .select()
        .from(tables.devices)
        .where(and(eq(tables.devices.siteId, attr.siteId), eq(tables.devices.type, "METER")));
      for (const meter of meters) {
        const cals = await db
          .select()
          .from(tables.calibrations)
          .where(eq(tables.calibrations.deviceId, meter.id));
        if (
          hasValidCalibration(
            cals.map((c) => ({ validFrom: c.validFrom, validTo: c.validTo })),
            period.startsOn,
            period.endsOn,
          )
        ) {
          evidenceValid = true;
          break;
        }
      }
    } else {
      const consents = await db
        .select()
        .from(tables.dataReleaseConsents)
        .where(eq(tables.dataReleaseConsents.siteId, attr.siteId));
      evidenceValid = hasValidEvidenceBasis(
        consents.map((c) => ({
          signedAt: c.signedAt,
          expiresAt: c.expiresAt,
          revokedAt: c.revokedAt,
        })),
        period.startsOn,
        period.endsOn,
      );
    }
  }

  const check = validateTransition({
    from: attr.status,
    to,
    guards: {
      periodStatus: period?.status ?? "OPEN",
      contractValidAcrossPeriod: contractValid,
      evidenceBasisValidAcrossPeriod: evidenceValid,
      track: attr.track,
    },
  });

  if (!check.ok) {
    redirect(`/attributes?error=${encodeURIComponent(check.reason)}`);
  }

  await db.update(tables.attributes).set({ status: to }).where(eq(tables.attributes.id, attributeId));
  await db.insert(tables.attributeTransitions).values({
    attributeId,
    fromStatus: attr.status,
    toStatus: to,
    actorId: user.id,
  });
  await writeAudit({
    actorId: user.id,
    action: "attribute.transition",
    entityType: "attribute",
    entityId: attributeId,
    before: { status: attr.status },
    after: { status: to },
  });

  redirect("/attributes");
}
