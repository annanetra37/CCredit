import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DataCard } from "@/components/DataCard";
import { Forbidden } from "@/components/Forbidden";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";
import { canAccessGroup, getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

/**
 * Sprint 11 — vendor portal: white-labelled fleet monitoring across the
 * installed base (including non-contracted sites), referral pipeline and
 * commission statements.
 */
export default async function VendorFleetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessGroup(user.role, "vendor")) return <Forbidden />;

  const db = getDb();
  const fleet = user.vendorId
    ? await db.select().from(tables.sites).where(eq(tables.sites.vendorId, user.vendorId))
    : await db.select().from(tables.sites).limit(10); // admin preview

  const commissions = user.vendorId
    ? await db
        .select()
        .from(tables.vendorCommissions)
        .where(eq(tables.vendorCommissions.vendorId, user.vendorId))
        .orderBy(desc(tables.vendorCommissions.createdAt))
    : [];

  const totalCommission = commissions.reduce((s, c) => s + Number(c.amountAmd), 0);

  return (
    <div data-audience="external" className="mx-auto flex max-w-3xl flex-col gap-4 p-4 text-[15px]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900">Կայանների ցանց / Fleet</h1>
        <form action={logoutAction}>
          <button className="text-sm text-teal-600 underline">Դուրս գալ / Sign out</button>
        </form>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <DataCard layer="measurement" title="Կայաններ / Sites">
          <p className="numeric text-3xl font-semibold text-ink-900">{fleet.length}</p>
        </DataCard>
        <DataCard layer="commercial" title="Կոմիսիոն / Commission">
          <p className="numeric text-3xl font-semibold text-ink-900">
            {totalCommission.toLocaleString("hy-AM")} <span className="text-sm text-ink-500">֏</span>
          </p>
        </DataCard>
      </div>

      <DataCard layer="measurement" title="Մոնիտորինգ / Fleet monitoring">
        {fleet.length === 0 ? (
          <p className="text-sm text-ink-700">
            Ձեր տեղադրած կայանները կհայտնվեն այստեղ: / Your installed sites appear here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200">
            {fleet.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span className="text-ink-900">
                  {s.isSandbox ? "🧪 " : ""}
                  {s.name}
                </span>
                <span className="numeric text-sm text-ink-500">{s.capacityKw ?? "—"} kW</span>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard layer="commercial" title="Կոմիսիոն հաշվետվություններ / Commission statements">
        {commissions.length === 0 ? (
          <p className="text-sm text-ink-700">
            Կոմիսիոն վճարումները հաշվեգրվում են ամեն վաճառված վկայականից: /
            Commission accrues from every certificate sold from your referred sites.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200">
            {commissions.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="numeric">{c.periodLabel}</span>
                <span className="numeric font-semibold">{Number(c.amountAmd).toLocaleString("hy-AM")} ֏</span>
                <span className="text-sm text-ink-500">{c.paidAt ? "վճարված / paid" : "հաշվեգրված / accrued"}</span>
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}
