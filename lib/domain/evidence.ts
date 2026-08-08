/**
 * Evidence-basis guard (R1 §7). The original hasValidCalibration established
 * the pattern worth keeping: a domain function that blocks allocation when
 * the evidentiary basis does not cover the whole period. Under the
 * utility-data-first plan the basis is a valid ENA data-release consent, not
 * our own calibration — the shape of the guard is the valuable part: it is
 * what stops an attribute being created on a period we have no right to sell.
 *
 * (hasValidCalibration itself is retained in ./calibration.ts for the edge
 * case where a site promotes our own METER to record of account.)
 */

export interface ConsentWindow {
  signedAt: Date;
  /** null = no expiry set */
  expiresAt: Date | null;
  /** Revocation stops FUTURE acquisition; coverage ends at revocation. */
  revokedAt: Date | null;
}

/**
 * True only if the union of consent windows covers [periodStart, periodEnd]
 * with no gap. Same interval mathematics as calibration coverage.
 */
export function hasValidEvidenceBasis(
  consents: ConsentWindow[],
  periodStart: Date,
  periodEnd: Date,
): boolean {
  if (periodEnd <= periodStart) return false;

  const windows = consents
    .map((c) => ({
      from: c.signedAt,
      to: earliest(c.expiresAt, c.revokedAt),
    }))
    .filter((w) => (w.to === null || w.to > periodStart) && w.from < periodEnd)
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  let coveredUntil = periodStart.getTime();
  for (const w of windows) {
    if (w.from.getTime() > coveredUntil) return false; // gap
    const end = w.to === null ? Number.POSITIVE_INFINITY : w.to.getTime();
    coveredUntil = Math.max(coveredUntil, end);
    if (coveredUntil >= periodEnd.getTime()) return true;
  }
  return coveredUntil >= periodEnd.getTime();
}

function earliest(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}
