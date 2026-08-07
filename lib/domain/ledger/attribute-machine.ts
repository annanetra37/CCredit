/**
 * Attribute state machine (S7-2). Pure function — no I/O.
 *
 * One megawatt-hour produces exactly one certificate. The database enforces
 * uniqueness; this module enforces that the lifecycle of that single row can
 * only move along legal edges, and that ALLOCATED is unreachable unless every
 * guard holds.
 */

export const ATTR_STATUSES = [
  "MEASURED",
  "RECONCILED",
  "DISPUTED",
  "ELIGIBLE",
  "ALLOCATED",
  "ISSUED",
  "TRANSFERRED",
  "REDEEMED",
  "VOID",
] as const;

export type AttrStatus = (typeof ATTR_STATUSES)[number];
export type AttrTrack = "UNASSIGNED" | "IREC" | "CARBON";

/** Legal transitions per functional spec §3.2. */
const LEGAL: Record<AttrStatus, AttrStatus[]> = {
  MEASURED: ["RECONCILED", "DISPUTED", "VOID"],
  RECONCILED: ["ELIGIBLE", "DISPUTED", "VOID"],
  DISPUTED: ["RECONCILED", "VOID"],
  ELIGIBLE: ["ALLOCATED", "VOID"],
  ALLOCATED: ["ISSUED", "ELIGIBLE", "VOID"], // back to ELIGIBLE = de-allocation before issuance
  ISSUED: ["TRANSFERRED", "REDEEMED"],
  TRANSFERRED: ["REDEEMED"],
  REDEEMED: [], // terminal and irreversible
  VOID: [], // terminal
};

export function isLegalTransition(from: AttrStatus, to: AttrStatus): boolean {
  return LEGAL[from].includes(to);
}

export function legalNextStatuses(from: AttrStatus): AttrStatus[] {
  return [...LEGAL[from]];
}

export interface AllocationGuardInput {
  /** Period status must be RECONCILED. */
  periodStatus: "OPEN" | "AWAITING_SOURCE" | "RECONCILED" | "DISPUTED" | "VOID";
  /** A contract must be valid across the whole period. */
  contractValidAcrossPeriod: boolean;
  /**
   * The evidentiary basis must cover the whole period (R1 §7): a valid ENA
   * data-release consent (hasValidEvidenceBasis) — or, for sites that promote
   * our own METER to record of account, calibration (hasValidCalibration).
   */
  evidenceBasisValidAcrossPeriod: boolean;
  /** A track must be assigned before allocation. */
  track: AttrTrack;
}

export interface TransitionRequest {
  from: AttrStatus;
  to: AttrStatus;
  guards?: AllocationGuardInput;
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string; reasonKey: string };

/**
 * Validate a status transition. Every failure names the exact rule violated —
 * "surfaces a specific domain error, not a raw constraint violation".
 */
export function validateTransition(req: TransitionRequest): TransitionResult {
  const { from, to } = req;

  if (from === to) {
    return { ok: false, reasonKey: "noop", reason: "Already in that status." };
  }

  if (!isLegalTransition(from, to)) {
    return {
      ok: false,
      reasonKey: "illegal_transition",
      reason: `An attribute cannot move from ${from} to ${to}. Legal next steps: ${
        LEGAL[from].join(", ") || "none — this status is terminal"
      }.`,
    };
  }

  if (to === "ALLOCATED") {
    const g = req.guards;
    if (!g) {
      return {
        ok: false,
        reasonKey: "guards_missing",
        reason:
          "Allocation requires guard checks (period, contract, calibration, track).",
      };
    }
    if (g.periodStatus !== "RECONCILED") {
      return {
        ok: false,
        reasonKey: "period_not_reconciled",
        reason: `The period must be RECONCILED before allocation (currently ${g.periodStatus}).`,
      };
    }
    if (!g.contractValidAcrossPeriod) {
      return {
        ok: false,
        reasonKey: "contract_invalid",
        reason:
          "No valid contract covers the whole period. Attributes cannot accrue without a signed basis.",
      };
    }
    if (!g.evidenceBasisValidAcrossPeriod) {
      return {
        ok: false,
        reasonKey: "evidence_basis_invalid",
        reason:
          "The evidentiary basis does not cover the whole period — no valid ENA data-release consent (or meter calibration, where our own meter is the record of account). An attribute cannot be created on a period we have no right to sell.",
      };
    }
    if (g.track === "UNASSIGNED") {
      return {
        ok: false,
        reasonKey: "track_unassigned",
        reason:
          "A track (I-REC or Carbon) must be assigned before allocation. Track assignment is deliberate and recorded.",
      };
    }
  }

  return { ok: true };
}

/** Statuses that count as sellable/committed for inventory purposes. */
export function isCommitted(status: AttrStatus): boolean {
  return ["ALLOCATED", "ISSUED", "TRANSFERRED", "REDEEMED"].includes(status);
}
