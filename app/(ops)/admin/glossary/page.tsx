import { asc } from "drizzle-orm";
import { BilingualField } from "@/components/BilingualField";
import { DataCard } from "@/components/DataCard";
import { Forbidden } from "@/components/Forbidden";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { upsertGlossaryAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

/** S0-4: glossary content editable by non-engineers without a deploy. */
export default async function GlossaryAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !["admin", "ops"].includes(user.role)) return <Forbidden />;
  const { error } = await searchParams;

  const db = getDb();
  const rows = await db
    .select()
    .from(tables.glossaryEntries)
    .orderBy(asc(tables.glossaryEntries.key), asc(tables.glossaryEntries.locale));

  const pairs = new Map<string, { hy?: (typeof rows)[number]; en?: (typeof rows)[number] }>();
  for (const r of rows) {
    const p = pairs.get(r.key) ?? {};
    p[r.locale as "hy" | "en"] = r;
    pairs.set(r.key, p);
  }

  const input = "min-h-11 w-full rounded-input border border-ink-200 bg-surface-1 px-3 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">Glossary admin</h1>
      <p className="text-sm text-ink-700">
        Rule: no new domain noun ships without a glossary entry in both
        locales. Missing halves show in amber below.
      </p>
      {error && (
        <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <DataCard layer="commercial" title="Add or update an entry">
        <form action={upsertGlossaryAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Key (snake_case)
              <input name="key" required pattern="[a-z0-9_]+" className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Locale
              <select name="locale" className={input}>
                <option value="hy">hy</option>
                <option value="en">en</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
              Group
              <select name="groupKey" className={input}>
                {["attributes", "carbon", "measurement", "roles", "system"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Term (display name)
            <input name="term" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Short (one line, hover tooltip)
            <input name="short" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            ELI5 (2–4 sentences, plain language)
            <textarea name="eli5" required minLength={10} rows={3} className="rounded-input border border-ink-200 bg-surface-1 p-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Why it matters here
            <textarea name="whyItMatters" required minLength={10} rows={2} className="rounded-input border border-ink-200 bg-surface-1 p-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            Example (optional)
            <textarea name="example" rows={2} className="rounded-input border border-ink-200 bg-surface-1 p-3 text-sm" />
          </label>
          <button className="min-h-11 self-start rounded-input bg-teal-600 px-5 text-sm font-semibold text-white">
            Save entry
          </button>
        </form>
      </DataCard>

      <DataCard layer="commercial" title={`Entries (${pairs.size} keys)`}>
        <div className="flex flex-col gap-3">
          {[...pairs.entries()].map(([key, p]) => (
            <BilingualField
              key={key}
              label={key}
              hy={
                p.hy ? (
                  <p className="rounded-input bg-surface-2 p-2 text-sm">{p.hy.term}: {p.hy.short}</p>
                ) : (
                  <p className="rounded-input bg-butter p-2 text-sm font-semibold text-amber-700">missing hy!</p>
                )
              }
              en={
                p.en ? (
                  <p className="rounded-input bg-surface-2 p-2 text-sm">{p.en.term}: {p.en.short}</p>
                ) : (
                  <p className="rounded-input bg-butter p-2 text-sm font-semibold text-amber-700">missing en!</p>
                )
              }
            />
          ))}
          {pairs.size === 0 && (
            <p className="text-sm text-ink-700">
              Database is empty — the compiled seed is serving the UI. Run{" "}
              <code className="numeric">npm run db:seed</code> to make entries editable here.
            </p>
          )}
        </div>
      </DataCard>
    </div>
  );
}
