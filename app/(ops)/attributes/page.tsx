import { asc, desc, eq } from "drizzle-orm";
import { DataCard } from "@/components/DataCard";
import { EmptyState } from "@/components/EmptyState";
import { InfoTip } from "@/components/InfoTip";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";
import {
  assignTrackAction,
  transitionAttributeAction,
} from "@/lib/actions/attributes";
import { legalNextStatuses } from "@/lib/domain/ledger/attribute-machine";

export const dynamic = "force-dynamic";

/** Sprint 7: the attribute ledger — after this, double-issuance is structurally impossible. */
export default async function AttributesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sandbox?: string }>;
}) {
  const { error, sandbox } = await searchParams;
  const showSandbox = sandbox === "1";
  const db = getDb();

  const rows = await db
    .select({ attr: tables.attributes, site: tables.sites, period: tables.periods })
    .from(tables.attributes)
    .innerJoin(tables.sites, eq(tables.attributes.siteId, tables.sites.id))
    .innerJoin(tables.periods, eq(tables.attributes.periodId, tables.periods.id))
    .where(eq(tables.attributes.isSandbox, showSandbox))
    .orderBy(desc(tables.periods.startsOn));

  const sites = await db.select().from(tables.sites).orderBy(asc(tables.sites.name));

  const totalMwh = rows.reduce((s, r) => s + Number(r.attr.mwh), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">
          Attribute ledger <InfoTip termKey="environmental_attribute" />
        </h1>
        <a
          href={showSandbox ? "/attributes" : "/attributes?sandbox=1"}
          className="min-h-11 rounded-input border border-ink-200 px-4 py-2 text-sm text-ink-700 hover:bg-surface-2"
        >
          {showSandbox ? "Production inventory" : "🧪 Sandbox inventory"}
        </a>
      </div>
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <DataCard
        layer="energy"
        title={`Inventory ${showSandbox ? "(sandbox — excluded from totals by default)" : ""}`}
        infoKey="vintage"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No attributes yet"
            explanation="Attributes appear automatically when a period is measured and reconciled. One MWh-period, one row, one destiny."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Vintage</th>
                  <th className="px-3 py-2">MWh</th>
                  <th className="px-3 py-2">Track</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Serial</th>
                  <th className="px-3 py-2">Move</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {rows.map(({ attr, site, period }) => (
                  <tr key={attr.id}>
                    <td className="px-3 py-2 text-ink-900">
                      {site.name}
                      {attr.isSandbox && " 🧪"}
                    </td>
                    <td className="numeric px-3 py-2">{period.startsOn.toISOString().slice(0, 7)}</td>
                    <td className="numeric px-3 py-2">{Number(attr.mwh).toFixed(4)}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={attr.track} termKey={attr.track === "CARBON" ? "vcu" : attr.track === "IREC" ? "i_rec" : "additionality"} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={attr.status} />
                    </td>
                    <td className="numeric px-3 py-2 text-xs">{attr.serialNo ?? "—"}</td>
                    <td className="px-3 py-2">
                      {legalNextStatuses(attr.status)
                        .filter((s) => !["ISSUED", "TRANSFERRED", "REDEEMED"].includes(s))
                        .map((s) => (
                          <form key={s} action={transitionAttributeAction} className="inline">
                            <input type="hidden" name="attributeId" value={attr.id} />
                            <input type="hidden" name="to" value={s} />
                            <button className="mr-1 rounded-badge bg-mist px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-600 hover:text-white">
                              → {s}
                            </button>
                          </form>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="numeric px-3 py-2">{totalMwh.toFixed(4)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard layer="carbon" title="Track assignment" infoKey="additionality">
        <p className="mb-3 text-sm text-ink-700">
          Decide per site which product it may produce. The choice is deliberate,
          recorded, and effectively irreversible — changing it later needs an
          admin override that writes an audit record.
        </p>
        <form action={assignTrackAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Site
              <select name="siteId" required className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3">
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.isSandbox ? "🧪 " : ""}
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Outcome
              <select name="outcome" required className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3">
                <option value="IREC_ONLY">IREC_ONLY</option>
                <option value="CARBON_ELIGIBLE">CARBON_ELIGIBLE</option>
                <option value="PENDING_REVIEW">PENDING_REVIEW</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Named assessor
              <input name="assessorName" required className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Cohort (optional)
              <input name="cohort" className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Written rationale (required)
            <textarea name="rationale" required minLength={20} rows={3} className="rounded-input border border-ink-200 bg-surface-1 p-3" />
          </label>
          <button className="min-h-11 self-start rounded-input bg-lilac-700 px-5 text-sm font-semibold text-white">
            Assign track
          </button>
        </form>
      </DataCard>
    </div>
  );
}
