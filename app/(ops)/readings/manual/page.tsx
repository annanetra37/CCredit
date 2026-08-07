import { asc, eq } from "drizzle-orm";
import { InfoTip } from "@/components/InfoTip";
import { SourceBadge } from "@/components/SourceBadge";
import { DataCard } from "@/components/DataCard";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { manualEntryAction } from "@/lib/actions/readings";

export const dynamic = "force-dynamic";

/**
 * S4-2: manual reading entry. The sprint that unblocks everything — the
 * whole pipeline can be exercised without hardware. Sandbox sites only,
 * unless admin.
 */
export default async function ManualEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const db = getDb();

  const sites =
    user?.role === "admin"
      ? await db.select().from(tables.sites).orderBy(asc(tables.sites.name))
      : await db
          .select()
          .from(tables.sites)
          .where(eq(tables.sites.isSandbox, true))
          .orderBy(asc(tables.sites.name));

  const input =
    "min-h-11 w-full rounded-input border border-ink-200 bg-surface-1 px-3 text-ink-900 numeric";
  const label = "flex flex-col gap-1 text-sm font-medium text-ink-700";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">
        Manual reading entry <SourceBadge source="MANUAL" />
      </h1>
      <p className="text-sm text-ink-700">
        Type in a period&apos;s generation figures and they flow through exactly the
        same reconciliation, ledger and calculation code as hardware readings.
        Every figure is stored with who typed it, permanently.
      </p>
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <DataCard layer="measurement" title="Period figures" infoKey="manual_reading">
        <form action={manualEntryAction} className="flex flex-col gap-4">
          <label className={label}>
            Site
            <select name="siteId" required className="min-h-11 w-full rounded-input border border-ink-200 bg-surface-1 px-3">
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.isSandbox ? "🧪 " : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Month
            <input name="month" type="month" required className={input} />
          </label>
          <label className={label}>
            <span>
              Meter export (MWh) <InfoTip termKey="net_export" />
            </span>
            <input name="meterMwh" type="number" step="0.0001" min="0" required className={input} />
            <span className="text-xs font-normal text-ink-500">
              What a revenue-grade meter at the grid connection would report — the record of account.
            </span>
          </label>
          <label className={label}>
            <span>
              Inverter total (MWh) <InfoTip termKey="reconciliation" />
            </span>
            <input name="inverterMwh" type="number" step="0.0001" min="0" className={input} />
            <span className="text-xs font-normal text-ink-500">
              What the inverter believes it produced. Usually slightly higher than the meter — cable losses are real.
            </span>
          </label>
          <label className={label}>
            <span>
              Utility bill (MWh) <InfoTip termKey="tolerance" />
            </span>
            <input name="utilityMwh" type="number" step="0.0001" min="0" className={input} />
            <span className="text-xs font-normal text-ink-500">
              What the utility credited. Often lags by a billing cycle — the third opinion.
            </span>
          </label>
          <label className={label}>
            <span>
              Auxiliary consumption (MWh, optional) <InfoTip termKey="auxiliary_consumption" />
            </span>
            <input name="auxiliaryMwh" type="number" step="0.0001" min="0" className={input} />
          </label>

          <div className="rounded-input bg-mist p-3 text-sm text-ink-900">
            On submit: readings land as <strong>MANUAL</strong> under your name, the
            period is created, and you&apos;re taken to reconciliation to watch the
            three numbers face each other.
          </div>

          <button className="min-h-11 rounded-input bg-teal-600 text-sm font-semibold text-white">
            Save readings
          </button>
        </form>
      </DataCard>
    </div>
  );
}
