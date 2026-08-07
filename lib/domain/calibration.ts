/**
 * Calibration coverage guard (S3-2). Expired calibration blocks issuance.
 *
 * Pure: takes calibration windows in, returns coverage out. The caller
 * fetches windows from the database; this module decides.
 */

export interface CalibrationWindow {
  validFrom: Date;
  /** null = currently in force */
  validTo: Date | null;
}

/**
 * True only if the union of calibration windows covers [periodStart, periodEnd]
 * with no gap. Handles partial coverage, a gap in the middle, and
 * back-to-back certificates.
 */
export function hasValidCalibration(
  windows: CalibrationWindow[],
  periodStart: Date,
  periodEnd: Date,
): boolean {
  if (periodEnd <= periodStart) return false;

  const sorted = windows
    .filter((w) => (w.validTo === null || w.validTo > periodStart) && w.validFrom < periodEnd)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  let coveredUntil = periodStart.getTime();
  for (const w of sorted) {
    if (w.validFrom.getTime() > coveredUntil) return false; // gap
    const end = w.validTo === null ? Number.POSITIVE_INFINITY : w.validTo.getTime();
    coveredUntil = Math.max(coveredUntil, end);
    if (coveredUntil >= periodEnd.getTime()) return true;
  }
  return coveredUntil >= periodEnd.getTime();
}

/** Days until a calibration lapses; negative = already expired. */
export function daysUntilExpiry(window: CalibrationWindow, now: Date): number | null {
  if (window.validTo === null) return null;
  return Math.floor(
    (window.validTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
}

/** Alert thresholds per S3-2: 90, 30 and 7 days before expiry. */
export const CALIBRATION_ALERT_DAYS = [90, 30, 7] as const;
