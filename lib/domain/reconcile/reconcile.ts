/**
 * Reconciliation engine (Sprint 6). Three disagreeing numbers become one
 * defensible number, or the system refuses.
 *
 * Rule: meter beats inverter. The METER value is the record of account when
 * a meter reading exists — encoded in SOURCE_PRECEDENCE so any other choice
 * is a type error, not a code-review comment.
 */

export const SOURCE_PRECEDENCE = ["METER", "INVERTER_API", "MANUAL"] as const;
export type ComparisonSource = "METER" | "INVERTER" | "UTILITY";

export interface ReconcileInput {
  meterMwh: number | null;
  inverterMwh: number | null;
  utilityMwh: number | null;
  /** Configurable tolerance, default 2%. Per-site override requires a logged reason upstream. */
  tolerancePct?: number;
  /** Single-source periods reconcile only with explicit supervisor approval. */
  supervisorApproved?: boolean;
}

export interface PairVariance {
  a: ComparisonSource;
  b: ComparisonSource;
  variancePct: number;
}

export interface ReconcileResult {
  outcome: "RECONCILED" | "DISPUTED" | "INSUFFICIENT_DATA";
  /** The value adopted as record of account (meter when present). */
  adoptedMwh: number | null;
  adoptedSource: ComparisonSource | null;
  sourcesPresent: ComparisonSource[];
  sourcesAbsent: ComparisonSource[];
  pairwise: PairVariance[];
  maxVariancePct: number | null;
  tolerancePct: number;
  /** True when fewer than three sources reconciled — surfaced in evidence packs. */
  fewerThanThreeSources: boolean;
  reason: string;
}

export const DEFAULT_TOLERANCE_PCT = 2;

function variancePct(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const base = Math.max(Math.abs(a), Math.abs(b));
  return (Math.abs(a - b) / base) * 100;
}

export function reconcile(input: ReconcileInput): ReconcileResult {
  const tolerancePct = input.tolerancePct ?? DEFAULT_TOLERANCE_PCT;

  const values: Array<{ source: ComparisonSource; mwh: number }> = [];
  if (input.meterMwh != null) values.push({ source: "METER", mwh: input.meterMwh });
  if (input.inverterMwh != null)
    values.push({ source: "INVERTER", mwh: input.inverterMwh });
  if (input.utilityMwh != null)
    values.push({ source: "UTILITY", mwh: input.utilityMwh });

  const present = values.map((v) => v.source);
  const absent = (["METER", "INVERTER", "UTILITY"] as ComparisonSource[]).filter(
    (s) => !present.includes(s),
  );

  // Meter beats inverter; without a meter fall back to utility, then inverter.
  const adoption: ComparisonSource[] = ["METER", "UTILITY", "INVERTER"];
  const adopted =
    adoption
      .map((s) => values.find((v) => v.source === s))
      .find((v) => v !== undefined) ?? null;

  const base = {
    sourcesPresent: present,
    sourcesAbsent: absent,
    tolerancePct,
    fewerThanThreeSources: present.length < 3,
  };

  if (values.length === 0) {
    return {
      ...base,
      outcome: "INSUFFICIENT_DATA",
      adoptedMwh: null,
      adoptedSource: null,
      pairwise: [],
      maxVariancePct: null,
      reason: "No sources present for this period.",
    };
  }

  if (values.length === 1) {
    // S6-3: single-source periods can reconcile only with explicit supervisor
    // approval, logged upstream.
    if (input.supervisorApproved) {
      return {
        ...base,
        outcome: "RECONCILED",
        adoptedMwh: adopted!.mwh,
        adoptedSource: adopted!.source,
        pairwise: [],
        maxVariancePct: null,
        reason: `Single source (${adopted!.source}) reconciled with supervisor approval.`,
      };
    }
    return {
      ...base,
      outcome: "INSUFFICIENT_DATA",
      adoptedMwh: null,
      adoptedSource: null,
      pairwise: [],
      maxVariancePct: null,
      reason:
        "Only one source present. Single-source reconciliation requires explicit supervisor approval.",
    };
  }

  const pairwise: PairVariance[] = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      pairwise.push({
        a: values[i]!.source,
        b: values[j]!.source,
        variancePct: variancePct(values[i]!.mwh, values[j]!.mwh),
      });
    }
  }
  const maxVariancePct = Math.max(...pairwise.map((p) => p.variancePct));

  if (maxVariancePct <= tolerancePct) {
    return {
      ...base,
      outcome: "RECONCILED",
      adoptedMwh: adopted!.mwh,
      adoptedSource: adopted!.source,
      pairwise,
      maxVariancePct,
      reason:
        present.length === 2
          ? `Two-source comparison within ${tolerancePct}% tolerance (${absent.join(", ")} absent — flagged on the period).`
          : `All three sources within ${tolerancePct}% tolerance. ${adopted!.source} adopted as record of account.`,
    };
  }

  return {
    ...base,
    outcome: "DISPUTED",
    adoptedMwh: null,
    adoptedSource: null,
    pairwise,
    maxVariancePct,
    reason: `Maximum variance ${maxVariancePct.toFixed(2)}% exceeds tolerance ${tolerancePct}%. Period goes to the exception queue.`,
  };
}
