import type { GlossaryEntry } from "@/components/GlossaryProvider";
import { seedGlossaryEntries } from "./content";
import { getDb, tables } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Load glossary entries for a locale from the database (edited without a
 * deploy). Falls back to the compiled seed when the database is unreachable
 * or empty, so the ELI5 system never goes dark.
 */
export async function loadGlossary(locale: string): Promise<GlossaryEntry[]> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(tables.glossaryEntries)
      .where(eq(tables.glossaryEntries.locale, locale));
    if (rows.length > 0) {
      return rows.map((r) => ({
        key: r.key,
        locale: r.locale,
        term: r.term,
        short: r.short,
        eli5: r.eli5,
        whyItMatters: r.whyItMatters,
        example: r.example,
        learnMoreUrl: r.learnMoreUrl,
        groupKey: r.groupKey,
        relatedKeys: r.relatedKeys,
      }));
    }
  } catch {
    // fall through to seed
  }
  return seedGlossaryEntries().filter((e) => e.locale === locale);
}
