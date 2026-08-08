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

  // S3B-5: months whose official ENA figure has not arrived yet render as
  // provisional — clearly marked, never in the ledger.
  const awaitingPeriods =
    siteIds.length > 0
      ? (
          await db
            .select()
            .from(tables.periods)
            .where(inArray(tables.periods.siteId, siteIds))
        ).filter((p) => p.status === "AWAITING_SOURCE" || p.status === "OPEN")
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
          ☀️ My solar / Իմ արևային կայանը
        </h1>
        <form action={logoutAction}>
          <button className="text-sm text-teal-600 underline">Sign out</button>
        </form>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <DataCard layer="energy" title="Generation / Արտադրություն" infoKey="net_export">
          <p className="numeric text-3xl font-semibold text-ink-900">
            {totalMwh.toFixed(2)} <span className="text-sm text-ink-500">MWh</span>
          </p>
        </DataCard>
        <DataCard layer="commercial" title="Earnings / Վճարումներ" infoKey="retained_share">
          <p className="numeric text-3xl font-semibold text-ink-900">
            {totalNetAmd.toLocaleString("hy-AM")} <span className="text-sm text-ink-500">֏</span>
          </p>
        </DataCard>
      </div>

      <DataCard layer="energy" title="By month / Ամսական" infoKey="provisional_figure">
        {attrs.length === 0 && awaitingPeriods.length === 0 ? (
          <p className="text-sm text-ink-700">
            No data yet — each month appears here once your site is measured. /
            Դեռ տվյալներ չկան․ չափումից հետո ամեն ամիս այստեղ կհայտնվի:
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200">
            {attrs.map(({ attr, period }) => (
              <li key={attr.id} className="flex items-center justify-between py-2">
                <span className="numeric">{period.startsOn.toISOString().slice(0, 7)}</span>
                <span className="numeric font-semibold">{Number(attr.mwh).toFixed(2)} MWh</span>
                <StatusPill status={attr.status} />
              </li>
            ))}
            {awaitingPeriods.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 opacity-80">
                <span className="numeric">{p.startsOn.toISOString().slice(0, 7)}</span>
                <span className="rounded-badge bg-butter px-2 py-0.5 text-xs font-semibold text-amber-700">
                  ~ provisional — awaiting official figure
                </span>
                <StatusPill status="AWAITING_SOURCE" />
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard layer="commercial" title="Payout statements / Վճարումների պատմություն">
        {payouts.length === 0 ? (
          <p className="text-sm text-ink-700">
            After your first payout, each monthly statement appears here: MWh,
            rate, gross, deductions, net. / Առաջին վճարումից հետո այստեղ
            կտեսնեք ամեն ամսվա հաշվետվությունը:
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-200">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="numeric">{p.periodLabel}</span>
                <span className="numeric">{Number(p.mwh).toFixed(2)} MWh</span>
                <span className="numeric font-semibold">{Number(p.netAmd).toLocaleString("hy-AM")} ֏</span>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard layer="carbon" title="What may I claim? / Ինչ կարող եմ ասել" infoKey="double_counting">
        <p className="text-sm leading-relaxed text-ink-900">
          You may not say “we run on solar” for sold attributes — that claim now
          belongs to the buyer. Your retained share
          <InfoTip termKey="retained_share" /> stays yours, with a downloadable
          claim statement.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Վաճառված ատրիբուտների մասին «մենք աշխատում ենք արևով» ասել չի կարելի —
          դա այժմ գնորդինն է: Ձեր պահվող բաժինը մնում է ձերը:
        </p>
      </DataCard>
    </div>
  );
}
