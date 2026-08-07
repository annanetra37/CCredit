/**
 * Expected yield model (R1 S6-2R): a modelled expectation per site and month
 * so obviously wrong figures are caught without a second meter. Also powers
 * the Sprint 11 underperformance alerts for owners and vendors.
 *
 * Model: monthly specific yield (kWh per kWp) for Armenia's latitude band,
 * derated for tilt/orientation deviation from optimum. Deliberately simple —
 * it refines against observed history after twelve months (the caller blends
 * observed averages in as they accumulate).
 */

/**
 * Approximate monthly specific yield for a well-oriented fixed system in
 * Armenia (kWh per kWp per month) — strong summers, real winters. Jan..Dec.
 */
export const ARMENIA_MONTHLY_SPECIFIC_YIELD = [
  70, 85, 115, 135, 155, 165, 170, 160, 135, 105, 75, 60,
] as const;

export interface YieldInput {
  capacityKw: number;
  /** Degrees from horizontal; optimum ≈ 32° at Armenian latitudes. */
  tiltDeg?: number | null;
  /** Degrees clockwise from north; optimum = 180 (south). */
  orientationDeg?: number | null;
  /** 0-based month, 0 = January. */
  month: number;
  /** Observed same-month history (MWh); blended in once present. */
  observedSameMonthMwh?: number[];
}

export function expectedMonthlyYieldMwh(input: YieldInput): number {
  if (input.capacityKw <= 0) return 0;
  const base =
    (ARMENIA_MONTHLY_SPECIFIC_YIELD[input.month % 12] ?? 100) * input.capacityKw;

  // Tilt derate: ~0.4% per degree away from optimum, capped at 25%.
  const tilt = input.tiltDeg ?? 32;
  const tiltDerate = Math.min(0.25, Math.abs(tilt - 32) * 0.004);

  // Orientation derate: ~0.2% per degree away from south, capped at 40%.
  const orientation = input.orientationDeg ?? 180;
  const orientationDerate = Math.min(0.4, Math.abs(orientation - 180) * 0.002);

  const modelled = (base * (1 - tiltDerate) * (1 - orientationDerate)) / 1000;

  // Refinement: once observed history for this calendar month exists, weight
  // it at 70/30 over the physical model — a December figure matching a June
  // expectation stays a fault either way, because history is month-specific.
  const observed = input.observedSameMonthMwh?.filter((v) => v > 0) ?? [];
  if (observed.length > 0) {
    const avg = observed.reduce((s, v) => s + v, 0) / observed.length;
    return round4(0.7 * avg + 0.3 * modelled);
  }
  return round4(modelled);
}

/** Deviation beyond ±15% raises FLAGGED with expected vs actual shown. */
export function yieldDeviationPct(actualMwh: number, expectedMwh: number): number | null {
  if (expectedMwh <= 0) return null;
  return Math.round((Math.abs(actualMwh - expectedMwh) / expectedMwh) * 10000) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
