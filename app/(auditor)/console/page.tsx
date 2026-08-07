import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DataCard } from "@/components/DataCard";
import { Forbidden } from "@/components/Forbidden";
import { InfoTip } from "@/components/InfoTip";
import { SourceBadge } from "@/components/SourceBadge";
import { getDb, tables } from "@/lib/db";
import { canAccessGroup, getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { triggerChainVerificationAction } from "@/lib/actions/admin";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Sprint 12 — auditor console. Read-only, fully access-logged,
 * point-in-time reconstruction via asOf, self-service chain verification.
 * The sprint with direct financial return: a VVB who can self-serve
 * evidence quotes lower every cycle.
 */
export default async function AuditorConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessGroup(user.role, "auditor")) return <Forbidden />;

  const { asOf: asOfRaw } = await searchParams;
  const asOf = asOfRaw ? new Date(asOfRaw) : new Date();

  // Every console view is itself an audited read (S0-5).
  await writeAudit({
    actorId: user.id,
    action: "auditor.console_view",
    entityType: "console",
    after: { asOf: asOf.toISOString() },
  });

  const db = getDb();

  // Point-in-time: bitemporal entities filtered by asOf; append-only tables
  // filtered by created_at.
  const contractsAsOf = await db
    .select()
    .from(tables.contracts)
    .where(
      and(
        lte(tables.contracts.validFrom, asOf),
        or(isNull(tables.contracts.validTo), gte(tables.contracts.validTo, asOf)),
      ),
    );
  const factorsAsOf = await db
    .select()
    .from(tables.emissionFactors)
    .where(
      and(
        lte(tables.emissionFactors.validFrom, asOf),
        or(isNull(tables.emissionFactors.validTo), gte(tables.emissionFactors.validTo, asOf)),
      ),
    );
  const readingsAsOf = await db
    .select({ r: tables.readingRaw })
    .from(tables.readingRaw)
    .where(lte(tables.readingRaw.createdAt, asOf))
    .orderBy(desc(tables.readingRaw.ts))
    .limit(20);

  const runs = await db
    .select()
    .from(tables.chainVerificationRuns)
    .orderBy(desc(tables.chainVerificationRuns.startedAt))
    .limit(5);

  const calculations = await db
    .select()
    .from(tables.carbonCalculations)
    .where(lte(tables.carbonCalculations.createdAt, asOf))
    .orderBy(desc(tables.carbonCalculations.createdAt))
    .limit(10);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900">
          Auditor console <InfoTip termKey="vvb" />
        </h1>
        <form action={logoutAction}>
          <button className="text-sm text-teal-600 underline">Sign out</button>
        </form>
      </header>

      <p className="rounded-input bg-mist p-3 text-sm text-ink-900">
        This account is read-only and every view you open is itself logged.
        Your account {user.role === "auditor" ? "expires automatically" : "(admin preview)"} —
        access is time-limited by design.
      </p>

      <DataCard layer="measurement" title="Point-in-time reconstruction" infoKey="point_in_time">
        <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            View the system as of
            <input
              name="asOf"
              type="date"
              defaultValue={asOf.toISOString().slice(0, 10)}
              className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3"
            />
          </label>
          <button className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white">
            Reconstruct
          </button>
        </form>
        <dl className="grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-input bg-surface-2 p-3">
            <dt className="text-xs uppercase text-ink-500">Contracts in force</dt>
            <dd className="numeric text-2xl font-semibold">{contractsAsOf.length}</dd>
          </div>
          <div className="rounded-input bg-surface-2 p-3">
            <dt className="text-xs uppercase text-ink-500">Emission factors in force</dt>
            <dd className="numeric text-2xl font-semibold">{factorsAsOf.length}</dd>
          </div>
          <div className="rounded-input bg-surface-2 p-3">
            <dt className="text-xs uppercase text-ink-500">Readings existing</dt>
            <dd className="numeric text-2xl font-semibold">{readingsAsOf.length}{readingsAsOf.length === 20 ? "+" : ""}</dd>
          </div>
        </dl>
      </DataCard>

      <DataCard layer="measurement" title="Chain verification" infoKey="hash_chain">
        <form action={triggerChainVerificationAction} className="mb-3">
          <button className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white">
            Run verification yourself
          </button>
        </form>
        <ul className="flex flex-col divide-y divide-ink-200 text-sm">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="numeric text-xs text-ink-500">
                {r.startedAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span>{r.readingsChecked} readings</span>
              <span className={r.ok ? "font-semibold text-mint-700" : "font-semibold text-rose-700"}>
                {r.ok == null ? "running…" : r.ok ? "intact" : "BREAK DETECTED"}
              </span>
              <span className="text-xs text-ink-500">triggered by {r.triggeredBy}</span>
            </li>
          ))}
          {runs.length === 0 && <li className="py-2 text-ink-500">No verification history yet.</li>}
        </ul>
      </DataCard>

      <DataCard layer="carbon" title="Calculations (traceable)" infoKey="grid_emission_factor">
        {calculations.length === 0 ? (
          <p className="text-sm text-ink-700">No carbon calculations as of this date.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200 text-sm">
            {calculations.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <span className="numeric font-semibold">{Number(c.tco2e).toFixed(4)} tCO₂e</span>
                <span className="numeric text-ink-700">{Number(c.netMwh).toFixed(4)} MWh net</span>
                <span className="text-xs text-ink-500">
                  {c.inputReadingIds.length} input reading(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard layer="measurement" title="Recent readings as of the chosen date">
        <ul className="flex flex-col divide-y divide-ink-200 text-sm">
          {readingsAsOf.map(({ r }) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="numeric text-xs text-ink-500">{r.ts.toISOString().slice(0, 10)}</span>
              <span className="numeric">{(Number(r.intervalWh) / 1_000_000).toFixed(4)} MWh</span>
              <SourceBadge source={r.source} />
            </li>
          ))}
        </ul>
      </DataCard>
    </div>
  );
}
