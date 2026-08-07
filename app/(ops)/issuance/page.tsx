import { and, desc, eq } from "drizzle-orm";
import { DataCard } from "@/components/DataCard";
import { InfoTip } from "@/components/InfoTip";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";
import {
  registerSiteWithIssuerAction,
  submitIssueRequestAction,
} from "@/lib/actions/issuance";

export const dynamic = "force-dynamic";

/** Sprint 9: the first real money path. */
export default async function IssuancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; issued?: string }>;
}) {
  const { error, issued } = await searchParams;
  const db = getDb();

  const sites = await db.select().from(tables.sites).orderBy(desc(tables.sites.createdAt));
  const registrations = await db.select().from(tables.registryRegistrations);
  const regBySite = new Map(registrations.map((r) => [r.siteId, r]));

  const allocatable = await db
    .select({ attr: tables.attributes, site: tables.sites, period: tables.periods })
    .from(tables.attributes)
    .innerJoin(tables.sites, eq(tables.attributes.siteId, tables.sites.id))
    .innerJoin(tables.periods, eq(tables.attributes.periodId, tables.periods.id))
    .where(and(eq(tables.attributes.status, "ALLOCATED"), eq(tables.attributes.track, "IREC")));

  const bySite = new Map<string, typeof allocatable>();
  for (const row of allocatable) {
    const list = bySite.get(row.site.id) ?? [];
    list.push(row);
    bySite.set(row.site.id, list);
  }

  const requests = await db
    .select()
    .from(tables.issueRequests)
    .orderBy(desc(tables.issueRequests.createdAt))
    .limit(10);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">
        I-REC issuance <InfoTip termKey="i_rec" />
      </h1>
      {issued && (
        <p className="rounded-input bg-mint px-3 py-2 text-sm font-semibold text-mint-700">
          ✓ {issued} certificate(s) issued with serial numbers bound to their attribute rows.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <DataCard layer="energy" title="Issuer registration" infoKey="issuer">
        <ul className="flex flex-col divide-y divide-ink-200 text-sm">
          {sites.map((s) => {
            const reg = regBySite.get(s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-ink-900">
                  {s.isSandbox ? "🧪 " : ""}
                  {s.name}
                </span>
                {reg ? (
                  <span className="flex items-center gap-2">
                    <span className="numeric text-xs text-ink-500">{reg.registryDeviceCode}</span>
                    <StatusPill status={reg.status} />
                  </span>
                ) : (
                  <form action={registerSiteWithIssuerAction}>
                    <input type="hidden" name="siteId" value={s.id} />
                    <button
                      className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
                      title={s.isSandbox ? "Sandbox sites are blocked at the service boundary" : undefined}
                    >
                      Register with Issuer
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </DataCard>

      <DataCard layer="energy" title="Issue request builder" infoKey="vintage">
        {bySite.size === 0 ? (
          <p className="text-sm text-ink-700">
            Nothing is ready to issue. An attribute must be ALLOCATED on the
            I-REC track — the guards (period reconciled, contract valid,
            calibration valid, track assigned) all have to pass first.
          </p>
        ) : (
          [...bySite.entries()].map(([siteId, rows]) => {
            const site = rows[0]!.site;
            const total = rows.reduce((s, r) => s + Number(r.attr.mwh), 0);
            return (
              <form key={siteId} action={submitIssueRequestAction} className="mb-4 flex flex-col gap-2">
                <input type="hidden" name="siteId" value={siteId} />
                <p className="font-semibold text-ink-900">
                  {site.isSandbox ? "🧪 " : ""}
                  {site.name}
                </p>
                {rows.map(({ attr, period }) => (
                  <label key={attr.id} className="flex min-h-11 items-center gap-2 text-sm text-ink-900">
                    <input type="checkbox" name="attributeIds" value={attr.id} defaultChecked className="h-5 w-5" />
                    <span className="numeric">{period.startsOn.toISOString().slice(0, 7)}</span>
                    <span className="numeric font-medium">{Number(attr.mwh).toFixed(4)} MWh</span>
                    <span className="text-xs text-ink-500">(volume from the ledger — not editable)</span>
                  </label>
                ))}
                <div className="rounded-input bg-surface-2 p-3 text-sm">
                  Pre-submission checklist: ALLOCATED ✓ · IREC track ✓ · volume from ledger ✓ ·
                  sandbox gate {site.isSandbox ? "✗ will block" : "✓"} · total{" "}
                  <span className="numeric font-semibold">{total.toFixed(4)} MWh</span>
                </div>
                <button className="min-h-11 self-start rounded-input bg-teal-600 px-5 text-sm font-semibold text-white">
                  Submit issue request
                </button>
              </form>
            );
          })
        )}
      </DataCard>

      <DataCard layer="commercial" title="Recent requests">
        {requests.length === 0 ? (
          <p className="text-sm text-ink-700">No issue requests yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span className="numeric text-xs text-ink-500">
                  {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
                <span className="numeric">{Number(r.totalMwh).toFixed(4)} MWh</span>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}
