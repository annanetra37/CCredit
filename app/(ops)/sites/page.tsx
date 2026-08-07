import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ sandbox?: string }>;
}) {
  const t = await getTranslations("empty");
  const { sandbox } = await searchParams;
  const db = getDb();

  // Sandbox sites excluded by default from all production list views (S1-4).
  const rows = await db
    .select({ site: tables.sites, owner: tables.owners })
    .from(tables.sites)
    .innerJoin(tables.owners, eq(tables.sites.ownerId, tables.owners.id))
    .where(eq(tables.sites.isSandbox, sandbox === "1"))
    .orderBy(desc(tables.sites.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Sites</h1>
        <div className="flex gap-2">
          <Link
            href={sandbox === "1" ? "/sites" : "/sites?sandbox=1"}
            className="min-h-11 rounded-input border border-ink-200 px-4 py-2 text-sm text-ink-700 hover:bg-surface-2"
          >
            {sandbox === "1" ? "Production sites" : "🧪 Sandbox sites"}
          </Link>
          <Link
            href="/sites/new"
            className="min-h-11 rounded-input bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
          >
            + New site
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No sites yet"
          explanation={t("sites")}
          action={
            <Link href="/sites/new" className="rounded-input bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
              Create the first site
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface-1 shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {rows.map(({ site, owner }) => (
                <tr key={site.id} className="hover:bg-surface-0">
                  <td className="px-4 py-3">
                    <Link href={`/sites/${site.id}`} className="font-medium text-teal-600 underline">
                      {site.name}
                    </Link>
                    {site.isSandbox && <span className="ml-2">🧪</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{owner.legalName}</td>
                  <td className="numeric px-4 py-3">{site.capacityKw ?? "—"} kW</td>
                  <td className="px-4 py-3">
                    <StatusPill status={site.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
