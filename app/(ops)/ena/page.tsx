import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { DataCard } from "@/components/DataCard";
import { InfoTip } from "@/components/InfoTip";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";
import {
  confirmExtractionAction,
  recordConsentAction,
  rejectExtractionAction,
  revokeConsentAction,
  uploadBillAction,
} from "@/lib/actions/ena";

export const dynamic = "force-dynamic";

const ENA_EXPECTED_LATENCY_DAYS = 45;

/**
 * R1 Sprint 3B — ENA data acquisition: upload/parse bills, human
 * confirmation queue, consent management, and coverage monitoring.
 */
export default async function EnaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; queued?: string }>;
}) {
  const { error, queued } = await searchParams;
  const db = getDb();

  const pending = await db
    .select()
    .from(tables.billExtractions)
    .where(eq(tables.billExtractions.status, "PENDING"))
    // Low confidence sorts to the top of the queue (S3B-3).
    .orderBy(asc(tables.billExtractions.confidence), desc(tables.billExtractions.createdAt));

  const sites = await db.select().from(tables.sites).orderBy(asc(tables.sites.name));
  const siteById = new Map(sites.map((s) => [s.id, s]));

  const consents = await db
    .select()
    .from(tables.dataReleaseConsents)
    .orderBy(desc(tables.dataReleaseConsents.createdAt));
  const activeConsentSiteIds = new Set(
    consents.filter((c) => !c.revokedAt && (!c.expiresAt || c.expiresAt > new Date())).map((c) => c.siteId),
  );

  // Coverage (S3B-4): every site × recent period — received / awaited / overdue.
  const periods = await db
    .select()
    .from(tables.periods)
    .orderBy(desc(tables.periods.startsOn))
    .limit(120);
  const now = Date.now();

  const coverage = periods.map((p) => {
    const site = siteById.get(p.siteId);
    const received = p.status === "RECONCILED" || p.status === "DISPUTED";
    const daysSinceEnd = Math.floor((now - p.endsOn.getTime()) / 86400000);
    const overdue = !received && daysSinceEnd > ENA_EXPECTED_LATENCY_DAYS;
    return { p, site, received, daysSinceEnd, overdue };
  });

  const input = "min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">
        ENA data acquisition <InfoTip termKey="ena_billing" />
      </h1>
      <p className="text-sm text-ink-700">
        ENA billing data is the record of account. Bills arrive here (any mode:
        feed, file drop, per-site request or owner upload), get parsed, and a
        human confirms every figure before it becomes a reading. Nothing is
        auto-accepted.
      </p>
      {queued && (
        <p className="rounded-input bg-mint px-3 py-2 text-sm font-semibold text-mint-700">
          ✓ {queued} row(s) parsed into the confirmation queue.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <DataCard layer="measurement" title="Upload / paste bill data" infoKey="data_release_consent">
        <form action={uploadBillAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            CSV (template: account_number,period_start,period_end,export_kwh,import_kwh,tariff)
            <textarea
              name="csv"
              rows={5}
              placeholder={"account_number,period_start,period_end,export_kwh,import_kwh,tariff\n0012345678,2026-01-01,2026-02-01,450,120,day-night"}
              className="numeric rounded-input border border-ink-200 bg-surface-1 p-3 text-sm"
            />
          </label>
          <button className="min-h-11 self-start rounded-input bg-teal-600 px-5 text-sm font-semibold text-white">
            Parse into queue
          </button>
        </form>
      </DataCard>

      <DataCard layer="measurement" title={`Confirmation queue (${pending.length})`} infoKey="manual_reading">
        {pending.length === 0 ? (
          <p className="text-sm text-ink-700">Queue is empty — every parsed bill has been reviewed.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((ext) => {
              const site = ext.siteId ? siteById.get(ext.siteId) : null;
              return (
                <div key={ext.id} className="rounded-input border border-ink-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-ink-900">
                      {site ? site.name : "⚠ UNMATCHED ACCOUNT"}
                    </span>
                    <span className="numeric text-ink-500">{ext.enaAccountNumber ?? "no account"}</span>
                    <span className="numeric text-ink-500">
                      {ext.periodStart ? ext.periodStart.toISOString().slice(0, 10) : "?"} →{" "}
                      {ext.periodEnd ? ext.periodEnd.toISOString().slice(0, 10) : "?"}
                    </span>
                    <span
                      className={`rounded-badge px-2 py-0.5 text-xs font-semibold ${
                        Number(ext.confidence) < 0.7 ? "bg-butter text-amber-700" : "bg-mint text-mint-700"
                      }`}
                    >
                      confidence {(Number(ext.confidence) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <form action={confirmExtractionAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="extractionId" value={ext.id} />
                    <label className="flex flex-col gap-1 text-xs font-medium text-ink-700">
                      Export kWh (extracted: {ext.exportKwh ?? "—"})
                      <input
                        name="exportKwh"
                        type="number"
                        step="0.001"
                        min="0"
                        required
                        defaultValue={ext.exportKwh ?? ""}
                        className={`${input} numeric`}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-ink-700">
                      Import kWh
                      <input
                        name="importKwh"
                        type="number"
                        step="0.001"
                        min="0"
                        defaultValue={ext.importKwh ?? ""}
                        className={`${input} numeric`}
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink-700">
                      Correction reason (required if you change a value)
                      <input name="correctionReason" className={input} />
                    </label>
                    <button className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white">
                      Confirm → reading
                    </button>
                  </form>
                  <form action={rejectExtractionAction} className="mt-2 flex items-end gap-2">
                    <input type="hidden" name="extractionId" value={ext.id} />
                    <input
                      name="reason"
                      required
                      minLength={5}
                      placeholder="Rejection reason"
                      className={`${input} flex-1`}
                    />
                    <button className="min-h-11 rounded-input bg-blush px-4 text-sm font-semibold text-rose-700">
                      Reject
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </DataCard>

      <DataCard layer="commercial" title="Data-release consents" infoKey="data_release_consent">
        <form action={recordConsentAction} className="mb-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Site
            <select name="siteId" required className={input}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.isSandbox ? "🧪 " : ""}
                  {s.name}
                  {activeConsentSiteIds.has(s.id) ? " ✓" : " — no consent"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Signatory
            <input name="signatoryName" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Expires (optional)
            <input name="expiresAt" type="date" className={input} />
          </label>
          <button className="min-h-11 rounded-input bg-teal-600 px-4 text-sm font-semibold text-white">
            Record consent
          </button>
        </form>
        <ul className="flex flex-col divide-y divide-ink-200 text-sm">
          {consents.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="text-ink-900">{siteById.get(c.siteId)?.name ?? c.siteId.slice(0, 8)}</span>
              <span className="text-ink-500">{c.signatoryName}</span>
              <span className="numeric text-xs text-ink-500">
                signed {c.signedAt.toISOString().slice(0, 10)}
                {c.expiresAt && ` · expires ${c.expiresAt.toISOString().slice(0, 10)}`}
              </span>
              {c.revokedAt ? (
                <span className="rounded-badge bg-blush px-2 py-0.5 text-xs font-semibold text-rose-700">
                  revoked
                </span>
              ) : (
                <form action={revokeConsentAction} className="flex items-center gap-2">
                  <input type="hidden" name="consentId" value={c.id} />
                  <input name="reason" required minLength={5} placeholder="reason" className="min-h-9 rounded-input border border-ink-200 px-2 text-xs" />
                  <button className="rounded-badge bg-blush px-3 py-1 text-xs font-semibold text-rose-700">
                    Revoke
                  </button>
                </form>
              )}
            </li>
          ))}
          {consents.length === 0 && (
            <li className="py-2 text-ink-500">
              No consents recorded. A site cannot enter the acquisition flow without one.
            </li>
          )}
        </ul>
      </DataCard>

      <DataCard layer="measurement" title="Coverage" infoKey="provisional_figure">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Days since period end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {coverage.map(({ p, site, received, daysSinceEnd, overdue }) => (
                <tr key={p.id} className={overdue ? "bg-blush" : undefined}>
                  <td className="px-3 py-2 text-ink-900">
                    {site?.isSandbox ? "🧪 " : ""}
                    {site?.name ?? "?"}
                  </td>
                  <td className="numeric px-3 py-2">{p.startsOn.toISOString().slice(0, 7)}</td>
                  <td className="px-3 py-2">
                    {received ? (
                      <StatusPill status={p.status} />
                    ) : overdue ? (
                      <span className="rounded-badge bg-blush px-2 py-0.5 text-xs font-bold text-rose-700">
                        OVERDUE — chase ENA
                      </span>
                    ) : (
                      <StatusPill status="AWAITING_SOURCE" />
                    )}
                  </td>
                  <td className="numeric px-3 py-2">{daysSinceEnd}</td>
                </tr>
              ))}
              {coverage.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-ink-500">
                    No periods yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
