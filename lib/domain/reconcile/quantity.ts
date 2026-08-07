/**
 * Quantity-aware reconciliation (R1 §6, S6-1R). Replaces the original ±2%
 * three-way comparison for utility-data-first sites: the sources no longer
 * measure the same thing. Inverter measures GENERATION; ENA measures EXPORT.
 * On a self-consuming site these differ by 50% or more BY DESIGN — that is
 * not a dispute.
 *
 *   generation    = inverter reading      (GENERATION)
 *   export        = ENA reading           (EXPORT)
 *   self_consumed = generation − export
 *
 * Hard rules (violation → DISPUTED, always):
 *   1. export ≤ generation
 *   2. self_consumed ≥ 0            (same fact, kept as its own named rule)
 * Soft rules (violation → FLAGGED: reconciled but surfaced, not blocked):
 *   3. self-consumption ratio within the site's learned band
 *   4. generation within ±15% of modelled yield
 *   5. export within ±2% of previous ratio × generation
 *
 * The original same-quantity engine (./reconcile.ts) is retained for sites
 * whose record of account is our own meter (three sources measuring EXPORT).
 */

export interface QuantityReconcileInput {
  /** ENA (or ranked record-of-account) export figure. null = not yet arrived. */
  exportMwh: number | null;
  /** Inverter generation figure. null = no inverter data. */
  generationMwh: number | null;
  /** Learned self-consumption band, once ≥3 periods of history exist. */
  expectedSelfConsumptionBand?: { min: number; max: number } | null;
  /** Modelled yield for this site+month (S6-2R). */
  modelledYieldMwh?: number | null;
  /** Previous period's export/generation ratio. */
  previousExportRatio?: number | null;
  /** Single-source (ENA alone) reconciliation needs supervisor approval. */
  supervisorApproved?: boolean;
}

export interface QuantityReconcileResult {
  outcome: "RECONCILED" | "DISPUTED" | "AWAITING_SOURCE" | "INSUFFICIENT_DATA";
  flagged: boolean;
  flagReasons: string[];
  disputeReasons: string[];
  selfConsumedMwh: number | null;
  selfConsumptionRatio: number | null;
  reason: string;
}

export const YIELD_TOLERANCE_PCT = 15;
export const EXPORT_RATIO_TOLERANCE_PCT = 2;

export function reconcileQuantities(
  input: QuantityReconcileInput,
): QuantityReconcileResult {
  const { exportMwh, generationMwh } = input;

  // §4.3: no record-of-account figure yet — the period WAITS, it is not broken.
  if (exportMwh == null) {
    return {
      outcome: "AWAITING_SOURCE",
      flagged: false,
      flagReasons: [],
      disputeReasons: [],
      selfConsumedMwh: null,
      selfConsumptionRatio: null,
      reason:
        "The record-of-account figure (ENA export) has not arrived yet. Provisional inverter figures are display-only and cannot enter the ledger.",
    };
  }

  // ENA alone, no inverter cross-check: single-source with supervisor approval.
  if (generationMwh == null) {
    if (input.supervisorApproved) {
      return {
        outcome: "RECONCILED",
        flagged: true,
        flagReasons: ["single_source_no_inverter"],
        disputeReasons: [],
        selfConsumedMwh: null,
        selfConsumptionRatio: null,
        reason:
          "Reconciled on ENA export alone with supervisor approval (no inverter data for cross-check).",
      };
    }
    return {
      outcome: "INSUFFICIENT_DATA",
      flagged: false,
      flagReasons: [],
      disputeReasons: [],
      selfConsumedMwh: null,
      selfConsumptionRatio: null,
      reason:
        "Only the ENA figure is present. Single-source reconciliation requires explicit supervisor approval.",
    };
  }

  const selfConsumed = round4(generationMwh - exportMwh);
  const ratio = generationMwh === 0 ? null : round4(selfConsumed / generationMwh);

  // Hard rules — never violated by honest data.
  const disputeReasons: string[] = [];
  if (exportMwh > generationMwh) {
    disputeReasons.push(
      `export_exceeds_generation: export ${exportMwh} MWh > generation ${generationMwh} MWh — physically impossible; one of the figures is wrong.`,
    );
  }
  if (selfConsumed < 0) {
    disputeReasons.push("negative_self_consumption");
  }
  if (disputeReasons.length > 0) {
    return {
      outcome: "DISPUTED",
      flagged: false,
      flagReasons: [],
      disputeReasons,
      selfConsumedMwh: selfConsumed,
      selfConsumptionRatio: ratio,
      reason: `Hard rule violated: ${disputeReasons[0]}`,
    };
  }

  // Soft rules — reconcile but surface for review.
  const flagReasons: string[] = [];

  if (
    input.expectedSelfConsumptionBand &&
    ratio != null &&
    (ratio < input.expectedSelfConsumptionBand.min ||
      ratio > input.expectedSelfConsumptionBand.max)
  ) {
    flagReasons.push(
      `self_consumption_outside_band: ratio ${(ratio * 100).toFixed(1)}% outside expected ${(input.expectedSelfConsumptionBand.min * 100).toFixed(0)}–${(input.expectedSelfConsumptionBand.max * 100).toFixed(0)}%`,
    );
  }

  if (input.modelledYieldMwh != null && input.modelledYieldMwh > 0) {
    const deviationPct =
      (Math.abs(generationMwh - input.modelledYieldMwh) / input.modelledYieldMwh) * 100;
    if (deviationPct > YIELD_TOLERANCE_PCT) {
      flagReasons.push(
        `yield_deviation: generation ${generationMwh} MWh vs modelled ${input.modelledYieldMwh} MWh (${deviationPct.toFixed(1)}% > ±${YIELD_TOLERANCE_PCT}%)`,
      );
    }
  }

  if (input.previousExportRatio != null && generationMwh > 0) {
    const predictedExport = input.previousExportRatio * generationMwh;
    if (predictedExport > 0) {
      const deltaPct = (Math.abs(exportMwh - predictedExport) / predictedExport) * 100;
      if (deltaPct > EXPORT_RATIO_TOLERANCE_PCT) {
        flagReasons.push(
          `export_ratio_shift: export ${exportMwh} MWh vs ${predictedExport.toFixed(4)} predicted from prior ratio (${deltaPct.toFixed(1)}% > ±${EXPORT_RATIO_TOLERANCE_PCT}%)`,
        );
      }
    }
  }

  return {
    outcome: "RECONCILED",
    flagged: flagReasons.length > 0,
    flagReasons,
    disputeReasons: [],
    selfConsumedMwh: selfConsumed,
    selfConsumptionRatio: ratio,
    reason:
      flagReasons.length > 0
        ? `Reconciled with ${flagReasons.length} soft-rule flag(s) for review.`
        : `Reconciled: ${exportMwh} MWh exported of ${generationMwh} MWh generated (${ratio != null ? (ratio * 100).toFixed(1) : "?"}% self-consumed).`,
  };
}

/**
 * Learn the expected self-consumption band from history (S6-1R): after three
 * observed periods, band = observed min/max widened by 10 percentage points.
 * Returns null until enough history exists — first periods carry no band.
 */
export function learnSelfConsumptionBand(
  historicRatios: number[],
): { min: number; max: number } | null {
  const valid = historicRatios.filter((r) => r >= 0 && r <= 1);
  if (valid.length < 3) return null;
  return {
    min: Math.max(0, Math.min(...valid) - 0.1),
    max: Math.min(1, Math.max(...valid) + 0.1),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
