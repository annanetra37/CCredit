/**
 * Site lifecycle state machine (S1-3), per functional spec §3.1.
 * LEAD → QUALIFYING → CONTRACTED → METERED → COMMISSIONED → ASSESSED → PRODUCING
 * plus SUSPENDED and TERMINATED.
 */

export const SITE_STATUSES = [
  "LEAD",
  "QUALIFYING",
  "CONTRACTED",
  "METERED",
  "COMMISSIONED",
  "ASSESSED",
  "PRODUCING",
  "SUSPENDED",
  "TERMINATED",
] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

const FORWARD: SiteStatus[] = [
  "LEAD",
  "QUALIFYING",
  "CONTRACTED",
  "METERED",
  "COMMISSIONED",
  "ASSESSED",
  "PRODUCING",
];

const LEGAL: Record<SiteStatus, SiteStatus[]> = {
  LEAD: ["QUALIFYING", "TERMINATED"],
  QUALIFYING: ["CONTRACTED", "TERMINATED"],
  CONTRACTED: ["METERED", "SUSPENDED", "TERMINATED"],
  METERED: ["COMMISSIONED", "SUSPENDED", "TERMINATED"],
  COMMISSIONED: ["ASSESSED", "SUSPENDED", "TERMINATED"],
  ASSESSED: ["PRODUCING", "SUSPENDED", "TERMINATED"],
  PRODUCING: ["SUSPENDED", "TERMINATED"],
  // A suspended site resumes to wherever it was — resolved by the caller
  // passing the resume target; all pre-suspension states are legal targets.
  SUSPENDED: ["CONTRACTED", "METERED", "COMMISSIONED", "ASSESSED", "PRODUCING", "TERMINATED"],
  TERMINATED: [],
};

export type SiteTransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateSiteTransition(
  from: SiteStatus,
  to: SiteStatus,
): SiteTransitionResult {
  if (from === to) return { ok: false, reason: "Site is already in that state." };
  if (!LEGAL[from].includes(to)) {
    return {
      ok: false,
      reason: `A site cannot move from ${from} to ${to}. Legal next steps: ${
        LEGAL[from].join(", ") || "none — TERMINATED is final"
      }.`,
    };
  }
  return { ok: true };
}

/** Ordering helper for progress displays. */
export function siteProgressIndex(status: SiteStatus): number {
  const i = FORWARD.indexOf(status);
  return i === -1 ? -1 : i;
}
