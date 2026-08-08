"use server";

import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  learnSelfConsumptionBand,
  reconcileQuantities,
} from "@/lib/domain/reconcile/quantity";
import { expectedMonthlyYieldMwh } from "@/lib/domain/yield/expected-yield";
import {
  canEnterLedger,
  recordOfAccountSource,
  type SourceKind,
} from "@/lib/domain/sources";

/**
 * Run reconciliation for a period — Revision R1, quantity-aware (S6-1R).
 * Sources are compared according to WHAT they measure: ENA export vs inverter
 * generation, with self-consumption modelled instead of flagged as a dispute.
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

  // Aggregate by measured quantity; export additionally by source so the
  // record of account is chosen by rank, not by arrival order.
  const endMs = period.endsOn.getTime();
  const exportBySource = new Map<SourceKind, number>();
  let generationMwh: number | null = null;
  const inputReadingIds: number[] = [];

  for (const r of rows) {
    const mwh = Number(r.intervalWh) / 1_000_000;
    inputReadingIds.push(r.id);

    // Legacy pre-R1 manual rows carried role in the ts offset; honour both.
    let quantity = r.quantity;
    if (r.source === "MANUAL" && quantity === "EXPORT") {
      const offset = endMs - r.ts.getTime();
      if (offset === 2000) quantity = "GENERATION";
    }
    if (r.source === "INVERTER_API") quantity = "GENERATION";

    if (quantity === "EXPORT") {
      const src = r.source as SourceKind;
      exportBySource.set(src, (exportBySource.get(src) ?? 0) + mwh);
    } else if (quantity === "GENERATION") {
      generationMwh = (generationMwh ?? 0) + mwh;
    }
  }

  const siteRank = site.sourceRank ?? null;
  const adoptedSource = recordOfAccountSource([...exportBySource.keys()], siteRank);
  const exportMwh = adoptedSource != null ? (exportBySource.get(adoptedSource) ?? null) : null;

  // Learned self-consumption band from prior reconciliations (S6-1R).
  const history = await db
    .select({ recon: tables.reconciliations, p: tables.periods })
    .from(tables.reconciliations)
    .innerJoin(tables.periods, eq(tables.reconciliations.periodId, tables.periods.id))
    .where(eq(tables.periods.siteId, site.id))
    .orderBy(desc(tables.reconciliations.createdAt))
    .limit(24);
  const ratios = history
    .filter((h) => h.recon.generationMwh != null && h.recon.selfConsumedMwh != null)
    .map((h) => Number(h.recon.selfConsumedMwh) / Number(h.recon.generationMwh))
    .filter((x) => Number.isFinite(x));
  const band = learnSelfConsumptionBand(ratios);

  const prev = history.find(
    (h) => h.recon.exportMwh != null && h.recon.generationMwh != null && Number(h.recon.generationMwh) > 0,
  );
  const previousExportRatio = prev
    ? Number(prev.recon.exportMwh) / Number(prev.recon.generationMwh)
    : null;

  // Expected yield model (S6-2R).
  const observedSameMonth = history
    .filter(
      (h) =>
        h.p.startsOn.getUTCMonth() === period.startsOn.getUTCMonth() &&
        h.recon.generationMwh != null,
    )
    .map((h) => Number(h.recon.generationMwh));
  const modelledYieldMwh = site.capacityKw
    ? expectedMonthlyYieldMwh({
        capacityKw: Number(site.capacityKw),
        tiltDeg: site.tiltDeg != null ? Number(site.tiltDeg) : null,
        orientationDeg: site.orientationDeg != null ? Number(site.orientationDeg) : null,
        month: period.startsOn.getUTCMonth(),
        observedSameMonthMwh: observedSameMonth,
      })
    : null;

  const result = reconcileQuantities({
    exportMwh,
    generationMwh,
    expectedSelfConsumptionBand: band,
    modelledYieldMwh,
    previousExportRatio,
    supervisorApproved,
  });

  const outcome =
    result.outcome === "RECONCILED"
      ? "RECONCILED"
      : result.outcome === "DISPUTED"
        ? "DISPUTED"
        : result.outcome === "AWAITING_SOURCE"
          ? "AWAITING_SOURCE"
          : "OPEN";

  const [recon] = await db
    .insert(tables.reconciliations)
    .values({
      periodId,
      generationMwh: generationMwh != null ? String(generationMwh) : null,
      exportMwh: exportMwh != null ? String(exportMwh) : null,
      selfConsumedMwh: result.selfConsumedMwh != null ? String(result.selfConsumedMwh) : null,
      flagged: result.flagged,
      flagReasons: result.flagReasons,
      // legacy columns kept in sync for older views/exports
      meterMwh: exportMwh != null ? String(exportMwh) : null,
      inverterMwh: generationMwh != null ? String(generationMwh) : null,
      utilityMwh: null,
      adoptedMwh:
        outcome === "RECONCILED"
          ? String(site.certifies === "GENERATION" ? (generationMwh ?? exportMwh) : exportMwh)
          : null,
      adoptedSource: adoptedSource ?? null,
      tolerancePct: "0",
      maxVariancePct: null,
      outcome,
      detail: { ...result, adoptedSource, modelledYieldMwh, band, inputReadingIds },
      runBy: user.id,
    })
    .returning();

  await db
    .update(tables.periods)
    .set({
      status: outcome,
      sourcesPresent: [...exportBySource.keys(), ...(generationMwh != null ? ["INVERTER/GENERATION"] : [])],
      supervisorApprovalBy: supervisorApproved ? user.id : null,
    })
    .where(eq(tables.periods.id, periodId));

  // Attribute lifecycle. Guard (S3B-5): provisional figures can never enter
  // the ledger — only a confirmed record-of-account source creates one.
  const certifiedMwh =
    site.certifies === "GENERATION" ? generationMwh : exportMwh;
  const ledgerGate = canEnterLedger(adoptedSource);

  let [attr] = await db
    .select()
    .from(tables.attributes)
    .where(and(eq(tables.attributes.siteId, site.id), eq(tables.attributes.periodId, periodId)));

  if (!attr && outcome === "RECONCILED" && certifiedMwh != null && ledgerGate.ok) {
    [attr] = await db
      .insert(tables.attributes)
      .values({
        siteId: site.id,
        periodId,
        mwh: String(certifiedMwh),
        isSandbox: site.isSandbox,
      })
      .returning();
  }

  if (attr) {
    const toStatus =
      outcome === "RECONCILED" ? "RECONCILED" : outcome === "DISPUTED" ? "DISPUTED" : attr.status;
    if (toStatus !== attr.status) {
      await db
        .update(tables.attributes)
        .set({
          status: toStatus,
          mwh: certifiedMwh != null && ledgerGate.ok ? String(certifiedMwh) : attr.mwh,
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
    after: {
      reconciliationId: recon!.id,
      outcome,
      flagged: result.flagged,
      flagReasons: result.flagReasons,
      adoptedSource,
    },
  });

  redirect(`/reconciliation?period=${periodId}`);
}

/** S6-3R: resolve a disputed/flagged period with a controlled outcome + note. */
export async function resolveDisputeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schema = z.object({
    reconciliationId: z.string().uuid(),
    outcome: z.enum([
      "BILLING_LAG",
      "ENA_ESTIMATED_READING",
      "INVERTER_OFFLINE",
      "CURTAILMENT",
      "SITE_LOAD_CHANGE",
      "EXTRACTION_ERROR",
      "INSTRUMENT_FAULT",
      "COMMS_GAP",
      "METER_REPLACEMENT",
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
