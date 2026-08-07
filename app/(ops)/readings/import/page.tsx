import { asc, eq } from "drizzle-orm";
import { DataCard } from "@/components/DataCard";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bulkImportAction } from "@/lib/actions/readings";

export const dynamic = "force-dynamic";

/** S4-3: bulk manual import — twelve months at once, all-or-nothing. */
export default async function BulkImportPage({
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

  const template = `month,meter_mwh,inverter_mwh,utility_mwh
2026-01,0.70,0.71,0.69
2026-02,0.85,0.86,0.84
2026-03,1.15,1.16,1.14`;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">Bulk import</h1>
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      <DataCard layer="measurement" title="CSV import" infoKey="manual_reading">
        <form action={bulkImportAction} className="flex flex-col gap-4">
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
            CSV rows (template below — paste or edit)
            <textarea
              name="csv"
              rows={10}
              defaultValue={template}
              className="numeric rounded-input border border-ink-200 bg-surface-1 p-3 text-sm text-ink-900"
            />
          </label>
          <p className="rounded-input bg-butter p-3 text-sm text-amber-700">
            All rows commit or none do. Bad rows are reported with line numbers
            and the whole import is refused — partial imports are not possible.
          </p>
          <button className="min-h-11 rounded-input bg-teal-600 text-sm font-semibold text-white">
            Validate & import
          </button>
        </form>
      </DataCard>
    </div>
  );
}
