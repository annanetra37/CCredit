import { getLocale, getTranslations } from "next-intl/server";
import { loadGlossary } from "@/lib/glossary/load";

/**
 * /glossary (S0-4): every entry, searchable, filterable by group — for
 * people who want to read ahead.
 */
export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("glossary");
  const { q, group } = await searchParams;

  const entries = (await loadGlossary(locale))
    .filter((e) => !group || e.groupKey === group)
    .filter(
      (e) =>
        !q ||
        `${e.term} ${e.short} ${e.eli5}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => a.term.localeCompare(b.term, locale));

  const groups = ["attributes", "carbon", "measurement", "roles", "system"] as const;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-ink-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-700">{t("subtitle")}</p>

      <form className="mt-6 flex flex-wrap gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="min-h-11 flex-1 rounded-input border border-ink-200 bg-surface-1 px-3 text-ink-900"
        />
        <select
          name="group"
          defaultValue={group ?? ""}
          className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-ink-900"
        >
          <option value="">—</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {t(`group.${g}`)}
            </option>
          ))}
        </select>
        <button className="min-h-11 rounded-input bg-teal-600 px-5 text-sm font-semibold text-white">
          {t("searchPlaceholder").replace("…", "")}
        </button>
      </form>

      <dl className="mt-8 flex flex-col gap-6">
        {entries.map((e) => (
          <div key={e.key} id={e.key} className="rounded-card bg-surface-1 p-5 shadow-soft">
            <dt className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold text-ink-900">{e.term}</span>
              <span className="rounded-badge bg-surface-2 px-3 py-0.5 text-xs font-medium text-ink-700">
                {t(`group.${e.groupKey as "attributes"}`)}
              </span>
            </dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-ink-900">{e.eli5}</dd>
            <dd className="mt-3 rounded-input bg-mist p-3 text-sm text-ink-900">
              <span className="font-semibold text-teal-600">{t("whyItMatters")}: </span>
              {e.whyItMatters}
            </dd>
            {e.example && (
              <dd className="mt-2 rounded-input bg-surface-2 p-3 text-sm text-ink-900">
                <span className="font-semibold text-ink-500">{t("example")}: </span>
                {e.example}
              </dd>
            )}
            {e.relatedKeys && e.relatedKeys.length > 0 && (
              <dd className="mt-3 flex flex-wrap gap-2 text-sm">
                {e.relatedKeys.map((k) => (
                  <a key={k} href={`#${k}`} className="rounded-badge bg-mist px-3 py-1 text-teal-600">
                    {k}
                  </a>
                ))}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </main>
  );
}
