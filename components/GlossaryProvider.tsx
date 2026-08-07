"use client";

/**
 * Client-side context carrying the glossary for the current locale. Server
 * layouts load entries from the database (edited without a deploy via the
 * admin CRUD screen) and hand them to this provider; every <InfoTip> reads
 * from here without its own fetch.
 */
import { createContext, useContext, type ReactNode } from "react";

export interface GlossaryEntry {
  key: string;
  locale: string;
  term: string;
  short: string;
  eli5: string;
  whyItMatters: string;
  example: string | null;
  learnMoreUrl: string | null;
  groupKey: string;
  relatedKeys: string[] | null;
}

const GlossaryContext = createContext<Map<string, GlossaryEntry>>(new Map());

export function GlossaryProvider({
  entries,
  children,
}: {
  entries: GlossaryEntry[];
  children: ReactNode;
}) {
  const map = new Map(entries.map((e) => [e.key, e]));
  return (
    <GlossaryContext.Provider value={map}>{children}</GlossaryContext.Provider>
  );
}

export function useGlossary(): Map<string, GlossaryEntry> {
  return useContext(GlossaryContext);
}
