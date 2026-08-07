import { desc, eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { DataCard } from "@/components/DataCard";
import { EmptyState } from "@/components/EmptyState";
import { SourceBadge } from "@/components/SourceBadge";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";
import {
  resolveDisputeAction,
  runReconciliationAction,
} from "@/lib/actions/reconcile";

export const dynamic = "force-dynamic";

/** Sprint 6: three disagreeing numbers become one defensible number, or the system refuses. */
export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; period?: string }>;
}) {
  const { error, period: focusPeriod } = await searchParams;
  const t = await getTranslations("empty");
  const db = getDb();

  const periods = await db
    .select({ period: tables.periods, site: tables.sites })
    .from(tables.periods)
    .innerJoin(tables.sites, eq(tables.periods.siteId, tables.sites.id))
    .orderBy(desc(tables.periods.startsOn))
    .limit(50);

  const periodIds = periods.map((p) => p.period.id);
  const recons =
    periodIds.length > 0
      ? await db
          .select()
          .from(tables.reconciliations)
          .where(inArray(tables.reconciliations.periodId, periodIds))
          .orderBy(desc(tables.reconciliations.createdAt))
      : [];
  const latestByPeriod = new Map<string, (typeof recons)[number]>();
  for (const r of recons) {
    if (!latestByPeriod.has(r.periodId)) latestByPeriod.set(r.periodId, r);
  }

  // Exception queue (S6-3R): DISPUTED above FLAGGED above the rest,
  // larger volumes first within a class.
  const sorted = [...periods].sort((a, b) => {
    const flaggedA = latestByPeriod.get(a.period.id)?.flagged ? 0 : 1;
    const flaggedB = latestByPeriod.get(b.period.id)?.flagged ? 0 : 1;
    const rank = (s: string, f: number) =>
      s === "DISPUTED" ? 0 : f === 0 ? 1 : s === "OPEN" || s === "AWAITING_SOURCE" ? 2 : 3;
    return (
      rank(a.period.status, flaggedA) - rank(b.period.status, flaggedB) ||
      a.period.startsOn.getTime() - b.period.startsOn.getTime()
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">Reconciliation</h1>
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {sorted.length === 0 && (
        <EmptyState title="No periods yet" explanation={t("readings")} />
      )}

      {sorted.map(({ period, site }) => {
        const recon = latestByPeriod.get(period.id);
        const focus = period.id === focusPeriod;
        return (
          <DataCard
            key={period.id}
            layer="measurement"
            title={`${site.name} — ${period.startsOn.toISOString().slice(0, 7)}`}
            infoKey={focus ? "reconciliation" : undefined}
            actions={<StatusPill status={period.status} />}
          >
            <div className="flex flex-col gap-3">
              {recon ? (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {(
                    [
                      ["Export (record of account)", recon.exportMwh ?? recon.meterMwh],
                      ["Generation (inverter)", recon.generationMwh ?? recon.inverterMwh],
                      ["Self-consumed", recon.selfConsumedMwh],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label} className="rounded-input bg-surface-2 p-3 text-center">
                      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
                      <p className="numeric text-lg font-semibold text-ink-900">
                        {v != null ? Number(v).toFixed(4) : "—"}
                      </p>
                    </div>
                  ))}
                  <p className="col-span-3 text-sm text-ink-700">
                    Certified figure:{" "}
                    <span className="numeric font-semibold">
                      {recon.adoptedMwh != null ? `${Number(recon.adoptedMwh).toFixed(4)} MWh` : "none"}
                    </span>{" "}
                    {recon.adoptedSource && <SourceBadge source={recon.adoptedSource} />}
                    {recon.flagged && (
                      <span className="ml-2 rounded-badge bg-butter px-2 py-0.5 text-xs font-semibold text-amber-700">
                        ⚑ FLAGGED for review
                      </span>
                    )}
                  </p>
                  {recon.flagged && recon.flagReasons && recon.flagReasons.length > 0 && (
                    <ul className="col-span-3 rounded-input bg-butter p-3 text-xs text-amber-700">
                      {recon.flagReasons.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : period.status === "AWAITING_SOURCE" ? (
                <p className="text-sm text-ink-700">
                  Waiting for the ENA figure (typically 30–45 days after period
                  end). Provisional inverter figures are display-only and cannot
                  enter the ledger.
                </p>
              ) : (
                <p className="text-sm text-ink-700">Not yet reconciled.</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {(period.status === "OPEN" ||
                  period.status === "AWAITING_SOURCE" ||
                  period.status === "DISPUTED") && (
                  <form action={runReconciliationAction}>
                    <input type="hidden" name="periodId" value={period.id} />
                    <button className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white">
                      Run reconciliation
                    </button>
                  </form>
                )}
                {(period.status === "OPEN" || period.status === "AWAITING_SOURCE") && (
                  <form action={runReconciliationAction}>
                    <input type="hidden" name="periodId" value={period.id} />
                    <input type="hidden" name="supervisorApproved" value="true" />
                    <button className="min-h-11 rounded-input border border-ink-200 px-4 text-sm text-ink-700">
                      Run with supervisor approval (ENA-only, no inverter)
                    </button>
                  </form>
                )}
              </div>

              {period.status === "DISPUTED" && recon && (
                <form
                  action={resolveDisputeAction}
                  className="flex flex-col gap-2 rounded-input bg-blush p-3"
                >
                  <input type="hidden" name="reconciliationId" value={recon.id} />
                  <p className="text-sm font-semibold text-rose-700">Resolve dispute</p>
                  <div className="flex flex-wrap gap-2">
                    <select name="outcome" className="min-h-11 flex-1 rounded-input border border-ink-200 bg-surface-1 px-3 text-sm">
                      {[
                        "BILLING_LAG",
                        "ENA_ESTIMATED_READING",
                        "INVERTER_OFFLINE",
                        "CURTAILMENT",
                        "SITE_LOAD_CHANGE",
                        "EXTRACTION_ERROR",
                        "METER_REPLACEMENT",
                        "ACCEPTED_WITH_VARIANCE",
                      ].map((o) => (
                        <option key={o} value={o}>
                          {o.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                    <select name="finalStatus" className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-sm">
                      <option value="RECONCILED">RECONCILED</option>
                      <option value="VOID">VOID</option>
                    </select>
                  </div>
                  <input
                    name="note"
                    required
                    minLength={10}
                    placeholder="Resolution note (required, goes to the audit log)"
                    className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-sm"
                  />
                  <button className="min-h-11 self-start rounded-input bg-rose-700 px-4 text-sm font-semibold text-white">
                    Resolve
                  </button>
                </form>
              )}
            </div>
          </DataCard>
        );
      })}
    </div>
  );
}
