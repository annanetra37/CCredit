import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import { DataCard } from "@/components/DataCard";
import { getDb, tables } from "@/lib/db";
import { triggerChainVerificationAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

/** S0-5: the system can answer questions about its own history. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; since?: string }>;
}) {
  const { entity, since } = await searchParams;
  const db = getDb();

  const filters: SQL[] = [];
  if (entity) filters.push(eq(tables.auditEvents.entityType, entity));
  if (since) filters.push(gte(tables.auditEvents.ts, new Date(since)));

  const events = await db
    .select()
    .from(tables.auditEvents)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(tables.auditEvents.ts))
    .limit(100);

  const runs = await db
    .select()
    .from(tables.chainVerificationRuns)
    .orderBy(desc(tables.chainVerificationRuns.startedAt))
    .limit(5);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">Audit log</h1>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="entity"
          defaultValue={entity ?? ""}
          placeholder="entity type (site, attribute, period…)"
          className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-sm"
        />
        <input name="since" type="date" defaultValue={since ?? ""} className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-sm" />
        <button className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white">Filter</button>
      </form>

      <DataCard layer="measurement" title="Chain verification history" infoKey="hash_chain">
        <form action={triggerChainVerificationAction} className="mb-3">
          <button className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white">
            Run verification now
          </button>
        </form>
        <ul className="flex flex-col divide-y divide-ink-200 text-sm">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="numeric text-xs text-ink-500">
                {r.startedAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span>{r.readingsChecked} readings / {r.devicesChecked} devices</span>
              <span className={r.ok ? "font-semibold text-mint-700" : "font-semibold text-rose-700"}>
                {r.ok == null ? "running…" : r.ok ? "intact" : `${(r.breaks ?? []).length} break(s)`}
              </span>
              <span className="text-xs text-ink-500">by {r.triggeredBy}</span>
            </li>
          ))}
          {runs.length === 0 && <li className="py-2 text-ink-500">No runs yet.</li>}
        </ul>
      </DataCard>

      <DataCard layer="commercial" title="Events">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="numeric px-3 py-2 text-xs text-ink-500">
                    {e.ts.toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2 font-medium text-ink-900">{e.action}</td>
                  <td className="px-3 py-2 text-ink-700">
                    {e.entityType}
                    {e.entityId && <span className="numeric text-xs text-ink-500"> {e.entityId.slice(0, 8)}</span>}
                  </td>
                  <td className="numeric px-3 py-2 text-xs text-ink-500">{e.actorId?.slice(0, 8) ?? "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
