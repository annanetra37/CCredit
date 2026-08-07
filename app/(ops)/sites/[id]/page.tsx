import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DataCard } from "@/components/DataCard";
import { SandboxBanner } from "@/components/SandboxBanner";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";
import { legalNextStatuses } from "./transitions";
import { transitionSiteAction } from "@/lib/actions/sites";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const db = getDb();

  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, id));
  if (!site) notFound();

  const [owner] = await db.select().from(tables.owners).where(eq(tables.owners.id, site.ownerId));
  const devices = await db.select().from(tables.devices).where(eq(tables.devices.siteId, id));
  const transitions = await db
    .select()
    .from(tables.siteTransitions)
    .where(eq(tables.siteTransitions.siteId, id))
    .orderBy(desc(tables.siteTransitions.ts));
  const periods = await db
    .select()
    .from(tables.periods)
    .where(eq(tables.periods.siteId, id))
    .orderBy(asc(tables.periods.startsOn));

  const nextStates = legalNextStatuses(site.status);

  return (
    <div className="flex flex-col gap-4">
      {site.isSandbox && <SandboxBanner />}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-ink-900">{site.name}</h1>
        <StatusPill status={site.status} />
      </div>
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard layer="commercial" title="Owner & site record">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-ink-500">Owner</dt>
            <dd className="text-ink-900">{owner?.legalName}</dd>
            <dt className="text-ink-500">Tax ID</dt>
            <dd className="numeric text-ink-900">{owner?.taxId}</dd>
            <dt className="text-ink-500">Capacity</dt>
            <dd className="numeric text-ink-900">{site.capacityKw ?? "—"} kW</dd>
            <dt className="text-ink-500">Technology</dt>
            <dd className="text-ink-900">{site.technology}</dd>
            <dt className="text-ink-500">Coordinates</dt>
            <dd className="numeric text-ink-900">
              {site.lat ? `${site.lat}, ${site.lon}` : "—"}
            </dd>
            <dt className="text-ink-500">Address</dt>
            <dd className="text-ink-900">{site.address ?? "—"}</dd>
          </dl>
        </DataCard>

        <DataCard layer="measurement" title="Devices" infoKey="revenue_grade_meter">
          {devices.length === 0 ? (
            <p className="text-sm text-ink-700">
              No devices yet. A meter must be registered before readings can be attributed to an instrument.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink-200 text-sm">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <span className="text-ink-900">
                    {d.type} <span className="numeric text-ink-500">{d.serial}</span>
                  </span>
                  <span className="text-ink-500">
                    {d.decommissionedAt ? "replaced" : (d.make ?? "")} {d.model ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataCard>
      </div>

      <DataCard layer="measurement" title="Lifecycle">
        {nextStates.length > 0 && (
          <form action={transitionSiteAction} className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="siteId" value={site.id} />
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Move to
              <select name="to" className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3">
                {nextStates.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink-700">
              Note
              <input name="note" className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3" />
            </label>
            <button className="min-h-11 rounded-input bg-teal-600 px-5 text-sm font-semibold text-white">
              Transition
            </button>
          </form>
        )}
        <ol className="flex flex-col divide-y divide-ink-200 text-sm">
          {transitions.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <span className="numeric text-xs text-ink-500">
                {t.ts.toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span className="text-ink-900">
                {t.fromStatus} → {t.toStatus}
              </span>
              {t.note && <span className="text-ink-500">— {t.note}</span>}
            </li>
          ))}
          {transitions.length === 0 && (
            <li className="py-2 text-ink-500">No transitions recorded yet.</li>
          )}
        </ol>
      </DataCard>

      <DataCard layer="energy" title="Periods" infoKey="reconciliation">
        {periods.length === 0 ? (
          <p className="text-sm text-ink-700">No periods yet — enter readings to create them.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200 text-sm">
            {periods.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="numeric text-ink-900">
                  {p.startsOn.toISOString().slice(0, 7)}
                </span>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}
