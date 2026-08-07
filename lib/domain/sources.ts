/**
 * Source hierarchy (R1 §4.1). ENA billing is the record of account; rank is
 * per-site data so a site where we DID install a meter can promote METER —
 * reverting to the hardware plan is a configuration change, not a rewrite.
 */

export type SourceKind =
  | "ENA_BILLING"
  | "METER"
  | "OWNER_STATEMENT"
  | "INVERTER_API"
  | "MANUAL";

export const DEFAULT_SOURCE_RANK: Record<SourceKind, number> = {
  ENA_BILLING: 1, // record of account
  METER: 2, // our own meter, edge cases only
  OWNER_STATEMENT: 3, // owner-supplied bill, cross-check
  INVERTER_API: 4, // cross-check + owner UX only
  MANUAL: 5, // operational fallback, flagged loudly
};

/** Pick the record-of-account source among those present, per site rank. */
export function recordOfAccountSource(
  present: SourceKind[],
  siteRank?: Record<string, number> | null,
): SourceKind | null {
  if (present.length === 0) return null;
  const rank = { ...DEFAULT_SOURCE_RANK, ...(siteRank ?? {}) };
  return [...present].sort(
    (a, b) => (rank[a] ?? 99) - (rank[b] ?? 99),
  )[0]!;
}

/**
 * S3B-5 guard: provisional figures can never enter the attribute ledger.
 * Inverter/derived numbers are owner UX, not evidence — an attribute may only
 * be created when a confirmed record-of-account source contributed the
 * certified figure.
 */
const LEDGER_GRADE: SourceKind[] = ["ENA_BILLING", "METER", "OWNER_STATEMENT", "MANUAL"];

export function canEnterLedger(
  adoptedSource: SourceKind | null,
): { ok: boolean; reason?: string } {
  if (!adoptedSource) {
    return {
      ok: false,
      reason:
        "No confirmed source present — provisional figures cannot enter the attribute ledger.",
    };
  }
  if (!LEDGER_GRADE.includes(adoptedSource)) {
    return {
      ok: false,
      reason: `${adoptedSource} is a cross-check/owner-UX source, not evidence. Wait for the ENA figure (or use the manual fallback, loudly badged).`,
    };
  }
  return { ok: true };
}
