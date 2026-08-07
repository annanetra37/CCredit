import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DataCard } from "@/components/DataCard";
import { Forbidden } from "@/components/Forbidden";
import { InfoTip } from "@/components/InfoTip";
import { StatusPill } from "@/components/StatusPill";
import { getDb, tables } from "@/lib/db";
import { canAccessGroup, getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

/**
 * Sprint 11 — owner portal. Armenian-first, mobile-first, larger base type
 * (data-audience=external bumps the base size). Generation, earnings, and
 * the retained renewable claim statement.
 */
export default async function OwnerPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessGroup(user.role, "owner")) return <Forbidden />;

  const db = getDb();
  const ownSites = user.ownerId
    ? await db.select().from(tables.sites).where(eq(tables.sites.ownerId, user.ownerId))
    : await db.select().from(tables.sites).limit(3); // admin preview

  const siteIds = ownSites.map((s) => s.id);
  const attrs =
    siteIds.length > 0
      ? await db
          .select({ attr: tables.attributes, period: tables.periods })
          .from(tables.attributes)
          .innerJoin(tables.periods, eq(tables.attributes.periodId, tables.periods.id))
          .where(inArray(tables.attributes.siteId, siteIds))
          .orderBy(desc(tables.periods.startsOn))
      : [];

  const payouts = user.ownerId
    ? await db
        .select()
        .from(tables.payouts)
        .where(eq(tables.payouts.ownerId, user.ownerId))
        .orderBy(desc(tables.payouts.createdAt))
    : [];

  const totalMwh = attrs.reduce((s, a) => s + Number(a.attr.mwh), 0);
  const totalNetAmd = payouts.reduce((s, p) => s + Number(p.netAmd), 0);

  return (
    <div data-audience="external" className="mx-auto flex max-w-2xl flex-col gap-4 p-4 text-[15px]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900">
          ☀️ Իմ արևային կայանը / My solar
        </h1>
        <form action={logoutAction}>
          <button className="text-sm text-teal-600 underline">Դուրս գալ</button>
        </form>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <DataCard layer="energy" title="Արտադրություն / Generation" infoKey="net_export">
          <p className="numeric text-3xl font-semibold text-ink-900">
            {totalMwh.toFixed(2)} <span className="text-sm text-ink-500">ՄՎտ·ժ / MWh</span>
          </p>
        </DataCard>
        <DataCard layer="commercial" title="Վճարումներ / Earnings" infoKey="retained_share">
          <p className="numeric text-3xl font-semibold text-ink-900">
            {totalNetAmd.toLocaleString("hy-AM")} <span className="text-sm text-ink-500">֏</span>
          </p>
        </DataCard>
      </div>

      <DataCard layer="energy" title="Ամսական / By month" infoKey="vintage">
        {attrs.length === 0 ? (
          <p className="text-sm text-ink-700">
            Դեռ տվյալներ չկան: Երբ ձեր կայանը սկսի չափվել, ամեն ամիս այստեղ
            կհայտնվի: / No data yet — each month appears here once measured.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200">
            {attrs.map(({ attr, period }) => (
              <li key={attr.id} className="flex items-center justify-between py-2">
                <span className="numeric">{period.startsOn.toISOString().slice(0, 7)}</span>
                <span className="numeric font-semibold">{Number(attr.mwh).toFixed(2)} ՄՎտ·ժ</span>
                <StatusPill status={attr.status} />
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard layer="commercial" title="Վճարումների պատմություն / Payout statements">
        {payouts.length === 0 ? (
          <p className="text-sm text-ink-700">
            Առաջին վճարումից հետո այստեղ կտեսնեք ամեն ամսվա հաշվետվությունը՝
            ՄՎտ·ժ, սակագին, համախառն, պահումներ, զուտ: / After your first
            payout, each monthly statement appears here: MWh, rate, gross,
            deductions, net.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="numeric">{p.periodLabel}</span>
                <span className="numeric">{Number(p.mwh).toFixed(2)} ՄՎտ·ժ</span>
                <span className="numeric font-semibold">{Number(p.netAmd).toLocaleString("hy-AM")} ֏</span>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard layer="carbon" title="Ինչ կարող եմ ասել / What may I claim?" infoKey="double_counting">
        <p className="text-sm leading-relaxed text-ink-900">
          Վաճառված ատրիբուտների մասին «մենք աշխատում ենք արևով» ասել չի կարելի —
          դա այժմ գնորդինն է: Ձեր պահվող բաժինը
          <InfoTip termKey="retained_share" /> մնում է ձերը, և դրա համար կարող եք
          ներբեռնել հայտարարության փաստաթուղթ:
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          You may not say “we run on solar” for sold attributes — that claim now
          belongs to the buyer. Your retained share stays yours, with a
          downloadable claim statement.
        </p>
      </DataCard>
    </div>
  );
}
