"use server";

import { and, asc, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  DEFAULT_TOLERANCE_PCT,
  reconcile,
} from "@/lib/domain/reconcile/reconcile";

/**
 * Run reconciliation for a period (S6-1): aggregate per-source figures from
 * raw readings, run the pure engine, persist the result, move the period,
 * and create/advance the period's attribute row.
 */
export async function runReconciliationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const periodId = z.string().uuid().parse(formData.get("periodId"));
  const supervisorApproved = formData.get("supervisorApproved") === "true";

  const db = getDb();
  const [period] = await db.select().from(tables.periods).where(eq(tables.periods.id, periodId));
  if (!period) redirect("/reconciliation");
  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, period.siteId));
  if (!site) redirect("/reconciliation");

  // Aggregate readings inside the window. Manual entry encodes the three
  // figure roles as close-of-period timestamp offsets (see readings.ts);
  // device sources map directly once hardware lands in Sprint 13.
  const rows = await db
    .select()
    .from(tables.readingRaw)
    .where(
      and(
        eq(tables.readingRaw.siteId, site.id),
        gte(tables.readingRaw.ts, period.startsOn),
        lt(tables.readingRaw.ts, period.endsOn),
      ),
    )
    .orderBy(asc(tables.readingRaw.ts));

  const endMs = period.endsOn.getTime();
  let meterMwh: number | null = null;
  let inverterMwh: number | null = null;
  let utilityMwh: number | null = null;
  const inputReadingIds: number[] = [];

  for (const r of rows) {
    const mwh = Number(r.intervalWh) / 1_000_000;
    inputReadingIds.push(r.id);
    if (r.source === "METER") meterMwh = (meterMwh ?? 0) + mwh;
    else if (r.source === "INVERTER_API") inverterMwh = (inverterMwh ?? 0) + mwh;
    else {
      // MANUAL: role encoded by close-of-period offset
      const offset = endMs - r.ts.getTime();
      if (offset === 1000) meterMwh = (meterMwh ?? 0) + mwh;
      else if (offset === 2000) inverterMwh = (inverterMwh ?? 0) + mwh;
      else if (offset === 3000) utilityMwh = (utilityMwh ?? 0) + mwh;
      else meterMwh = (meterMwh ?? 0) + mwh;
    }
  }

  const tolerancePct = site.reconcileTolerancePct
    ? Number(site.reconcileTolerancePct)
    : DEFAULT_TOLERANCE_PCT;

  const result = reconcile({
    meterMwh,
    inverterMwh,
    utilityMwh,
    tolerancePct,
    supervisorApproved,
  });

  const outcome = result.outcome === "RECONCILED" ? "RECONCILED" : result.outcome === "DISPUTED" ? "DISPUTED" : "OPEN";

  const [recon] = await db
    .insert(tables.reconciliations)
    .values({
      periodId,
      meterMwh: meterMwh != null ? String(meterMwh) : null,
      inverterMwh: inverterMwh != null ? String(inverterMwh) : null,
      utilityMwh: utilityMwh != null ? String(utilityMwh) : null,
      adoptedMwh: result.adoptedMwh != null ? String(result.adoptedMwh) : null,
      adoptedSource:
        result.adoptedSource === "METER" || meterMwh != null ? "MANUAL" : "MANUAL",
      tolerancePct: String(tolerancePct),
      maxVariancePct: result.maxVariancePct != null ? String(result.maxVariancePct) : null,
      outcome,
      detail: { ...result, inputReadingIds },
      runBy: user.id,
    })
    .returning();

  await db
    .update(tables.periods)
    .set({
      status: outcome,
      sourcesPresent: result.sourcesPresent,
      supervisorApprovalBy: supervisorApproved ? user.id : null,
    })
    .where(eq(tables.periods.id, periodId));

  // Attribute lifecycle: create on first reconciliation contact, then move.
  let [attr] = await db
    .select()
    .from(tables.attributes)
    .where(and(eq(tables.attributes.siteId, site.id), eq(tables.attributes.periodId, periodId)));

  if (!attr && result.adoptedMwh != null) {
    // Inherits is_sandbox from the site at creation (S1-4). The
    // one_attribute_per_period constraint makes a duplicate impossible.
    [attr] = await db
      .insert(tables.attributes)
      .values({
        siteId: site.id,
        periodId,
        mwh: String(result.adoptedMwh),
        isSandbox: site.isSandbox,
      })
      .returning();
  }

  if (attr) {
    const toStatus = outcome === "RECONCILED" ? "RECONCILED" : outcome === "DISPUTED" ? "DISPUTED" : attr.status;
    if (toStatus !== attr.status) {
      await db
        .update(tables.attributes)
        .set({
          status: toStatus,
          mwh: result.adoptedMwh != null ? String(result.adoptedMwh) : attr.mwh,
        })
        .where(eq(tables.attributes.id, attr.id));
      await db.insert(tables.attributeTransitions).values({
        attributeId: attr.id,
        fromStatus: attr.status,
        toStatus,
        actorId: user.id,
        note: result.reason,
      });
    }
  }

  await writeAudit({
    actorId: user.id,
    action: "reconciliation.run",
    entityType: "period",
    entityId: periodId,
    after: { reconciliationId: recon!.id, outcome, maxVariancePct: result.maxVariancePct },
  });

  redirect(`/reconciliation?period=${periodId}`);
}

/** S6-2: resolve a disputed period with a controlled outcome + mandatory note. */
export async function resolveDisputeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schema = z.object({
    reconciliationId: z.string().uuid(),
    outcome: z.enum([
      "INSTRUMENT_FAULT",
      "COMMS_GAP",
      "CURTAILMENT",
      "METER_REPLACEMENT",
      "BILLING_LAG",
      "DATA_ERROR",
      "ACCEPTED_WITH_VARIANCE",
    ]),
    note: z.string().min(10, "A resolution note is required."),
    finalStatus: z.enum(["RECONCILED", "VOID"]),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/reconciliation?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const data = parsed.data;

  const db = getDb();
  const [recon] = await db
    .select()
    .from(tables.reconciliations)
    .where(eq(tables.reconciliations.id, data.reconciliationId));
  if (!recon) redirect("/reconciliation");

  await db.insert(tables.reconciliationResolutions).values({
    reconciliationId: recon.id,
    outcome: data.outcome,
    note: data.note,
    resolvedBy: user.id,
  });

  await db
    .update(tables.periods)
    .set({ status: data.finalStatus })
    .where(eq(tables.periods.id, recon.periodId));

  const [attr] = await db
    .select()
    .from(tables.attributes)
    .where(eq(tables.attributes.periodId, recon.periodId));
  if (attr) {
    const toStatus = data.finalStatus === "RECONCILED" ? "RECONCILED" : "VOID";
    await db.update(tables.attributes).set({ status: toStatus }).where(eq(tables.attributes.id, attr.id));
    await db.insert(tables.attributeTransitions).values({
      attributeId: attr.id,
      fromStatus: attr.status,
      toStatus,
      actorId: user.id,
      note: `${data.outcome}: ${data.note}`,
    });
  }

  await writeAudit({
    actorId: user.id,
    action: "reconciliation.resolve",
    entityType: "reconciliation",
    entityId: recon.id,
    after: data,
  });

  redirect("/reconciliation");
}
