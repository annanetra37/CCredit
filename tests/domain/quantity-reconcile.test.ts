import { describe, expect, it } from "vitest";
import {
  learnSelfConsumptionBand,
  reconcileQuantities,
} from "@/lib/domain/reconcile/quantity";

/**
 * R1 S6-1R exhaustive cases: zero self-consumption, 100% self-consumption,
 * export exceeding generation, missing inverter, first period with no history.
 */
describe("quantity-aware reconciliation (S6-1R)", () => {
  it("a 60%-self-consuming site reconciles cleanly, not disputed", () => {
    const r = reconcileQuantities({ exportMwh: 3.2, generationMwh: 8.0 });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.flagged).toBe(false);
    expect(r.selfConsumedMwh).toBeCloseTo(4.8, 4);
    expect(r.selfConsumptionRatio).toBeCloseTo(0.6, 4);
  });

  it("zero self-consumption (export equals generation) reconciles", () => {
    const r = reconcileQuantities({ exportMwh: 5, generationMwh: 5 });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.selfConsumedMwh).toBe(0);
  });

  it("100% self-consumption (zero export) reconciles", () => {
    const r = reconcileQuantities({ exportMwh: 0, generationMwh: 5 });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.selfConsumptionRatio).toBe(1);
  });

  it("export exceeding generation → DISPUTED, always (hard rule 1)", () => {
    const r = reconcileQuantities({ exportMwh: 6, generationMwh: 5 });
    expect(r.outcome).toBe("DISPUTED");
    expect(r.disputeReasons.some((x) => x.includes("export_exceeds_generation"))).toBe(true);
  });

  it("missing ENA figure → AWAITING_SOURCE, not an error", () => {
    const r = reconcileQuantities({ exportMwh: null, generationMwh: 8 });
    expect(r.outcome).toBe("AWAITING_SOURCE");
  });

  it("missing inverter without approval → INSUFFICIENT_DATA", () => {
    const r = reconcileQuantities({ exportMwh: 3.2, generationMwh: null });
    expect(r.outcome).toBe("INSUFFICIENT_DATA");
  });

  it("missing inverter WITH supervisor approval → RECONCILED single-source, flagged", () => {
    const r = reconcileQuantities({
      exportMwh: 3.2,
      generationMwh: null,
      supervisorApproved: true,
    });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.flagged).toBe(true);
    expect(r.flagReasons).toContain("single_source_no_inverter");
  });

  it("first period with no history reconciles without band/model flags", () => {
    const r = reconcileQuantities({
      exportMwh: 3.2,
      generationMwh: 8.0,
      expectedSelfConsumptionBand: null,
      modelledYieldMwh: null,
      previousExportRatio: null,
    });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.flagged).toBe(false);
  });

  it("ratio outside the learned band → FLAGGED, not blocked (soft rule 3)", () => {
    const r = reconcileQuantities({
      exportMwh: 7.5,
      generationMwh: 8.0, // 6% self-consumption vs expected 50-70%
      expectedSelfConsumptionBand: { min: 0.5, max: 0.7 },
    });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.flagged).toBe(true);
    expect(r.flagReasons.some((x) => x.includes("self_consumption_outside_band"))).toBe(true);
  });

  it("generation far from modelled yield → FLAGGED (soft rule 4)", () => {
    const r = reconcileQuantities({
      exportMwh: 1,
      generationMwh: 2,
      modelledYieldMwh: 8, // December figure matching a June expectation is a fault
    });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.flagReasons.some((x) => x.includes("yield_deviation"))).toBe(true);
  });

  it("export ratio shift beyond ±2% of prior ratio → FLAGGED (soft rule 5)", () => {
    const r = reconcileQuantities({
      exportMwh: 5.0,
      generationMwh: 8.0,
      previousExportRatio: 0.4, // predicts 3.2 export
    });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.flagReasons.some((x) => x.includes("export_ratio_shift"))).toBe(true);
  });
});

describe("self-consumption band learning", () => {
  it("returns null until three periods of history exist", () => {
    expect(learnSelfConsumptionBand([])).toBeNull();
    expect(learnSelfConsumptionBand([0.5, 0.6])).toBeNull();
  });

  it("widens observed min/max by 10 points, clamped to [0,1]", () => {
    const band = learnSelfConsumptionBand([0.5, 0.55, 0.6]);
    expect(band).toEqual({ min: 0.4, max: 0.7 });
    const clamped = learnSelfConsumptionBand([0.02, 0.05, 0.95]);
    expect(clamped).toEqual({ min: 0, max: 1 });
  });
});
