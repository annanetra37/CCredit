import { desc, eq, isNull, sql } from "drizzle-orm";
import { DataCard } from "@/components/DataCard";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = getDb();

  const [siteCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.sites);
  const [disputed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.periods)
    .where(eq(tables.periods.status, "DISPUTED"));
  const [inventory] = await db
    .select({
      mwh: sql<string>`coalesce(sum(mwh), 0)`,
      n: sql<number>`count(*)::int`,
    })
    .from(tables.attributes)
    .where(sql`status in ('ELIGIBLE','ALLOCATED') and not is_sandbox`);
  const [issued] = await db
    .select({ mwh: sql<string>`coalesce(sum(mwh), 0)` })
    .from(tables.attributes)
    .where(sql`status in ('ISSUED','TRANSFERRED','REDEEMED') and not is_sandbox`);

  const openAlerts = await db
    .select()
    .from(tables.alerts)
    .where(isNull(tables.alerts.acknowledgedAt))
    .orderBy(desc(tables.alerts.createdAt))
    .limit(8);

  const lastVerification = await db
    .select()
    .from(tables.chainVerificationRuns)
    .orderBy(desc(tables.chainVerificationRuns.startedAt))
    .limit(1);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-ink-900">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DataCard layer="measurement" title="Sites">
          <p className="numeric text-3xl font-semibold text-ink-900">{siteCount?.n ?? 0}</p>
        </DataCard>
        <DataCard layer="measurement" title="Disputed periods" infoKey="tolerance">
          <p className="numeric text-3xl font-semibold text-ink-900">{disputed?.n ?? 0}</p>
        </DataCard>
        <DataCard layer="energy" title="Sellable inventory" infoKey="environmental_attribute">
          <p className="numeric text-3xl font-semibold text-ink-900">
            {Number(inventory?.mwh ?? 0).toFixed(2)}
            <span className="ml-1 text-sm text-ink-500">MWh</span>
          </p>
        </DataCard>
        <DataCard layer="energy" title="Issued to date" infoKey="i_rec">
          <p className="numeric text-3xl font-semibold text-ink-900">
            {Number(issued?.mwh ?? 0).toFixed(2)}
            <span className="ml-1 text-sm text-ink-500">MWh</span>
          </p>
        </DataCard>
      </div>

      <DataCard layer="measurement" title="Integrity" infoKey="hash_chain">
        {lastVerification.length === 0 ? (
          <p className="text-sm text-ink-700">No chain verification has run yet.</p>
        ) : (
          <p className="text-sm text-ink-900">
            Last run {lastVerification[0]!.startedAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
            {lastVerification[0]!.readingsChecked} readings ·{" "}
            {lastVerification[0]!.ok ? (
              <StatusPill status="RECONCILED" />
            ) : (
              <StatusPill status="DISPUTED" />
            )}
          </p>
        )}
      </DataCard>

      <DataCard layer="commercial" title="Open alerts">
        {openAlerts.length === 0 ? (
          <p className="text-sm text-ink-700">Nothing needs attention.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200">
            {openAlerts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className={`rounded-badge px-2 py-0.5 text-xs font-semibold ${
                    a.severity === "critical"
                      ? "bg-blush text-rose-700"
                      : a.severity === "warning"
                        ? "bg-butter text-amber-700"
                        : "bg-mist text-teal-600"
                  }`}
                >
                  {a.kind}
                </span>
                <span className="text-ink-900">{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}
