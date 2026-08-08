import { describe, expect, it } from "vitest";
import {
  expectedMonthlyYieldMwh,
  yieldDeviationPct,
} from "@/lib/domain/yield/expected-yield";

describe("expected yield model (S6-2R)", () => {
  it("summer months expect materially more than winter (seasonal profile)", () => {
    const june = expectedMonthlyYieldMwh({ capacityKw: 10, month: 5 });
    const december = expectedMonthlyYieldMwh({ capacityKw: 10, month: 11 });
    expect(june).toBeGreaterThan(december * 2);
  });

  it("a December figure matching a June expectation is a fault, not a success", () => {
    const december = expectedMonthlyYieldMwh({ capacityKw: 10, month: 11 });
    const juneLikeActual = expectedMonthlyYieldMwh({ capacityKw: 10, month: 5 });
    const deviation = yieldDeviationPct(juneLikeActual, december);
    expect(deviation).toBeGreaterThan(15);
  });

  it("badly oriented systems expect less", () => {
    const south = expectedMonthlyYieldMwh({ capacityKw: 10, month: 5, orientationDeg: 180 });
    const north = expectedMonthlyYieldMwh({ capacityKw: 10, month: 5, orientationDeg: 350 });
    expect(north).toBeLessThan(south);
  });

  it("refines toward observed history once it exists", () => {
    const pure = expectedMonthlyYieldMwh({ capacityKw: 10, month: 5 });
    const refined = expectedMonthlyYieldMwh({
      capacityKw: 10,
      month: 5,
      observedSameMonthMwh: [pure * 0.5, pure * 0.5],
    });
    expect(refined).toBeLessThan(pure);
    expect(refined).toBeGreaterThan(pure * 0.5);
  });

  it("zero capacity → zero expectation", () => {
    expect(expectedMonthlyYieldMwh({ capacityKw: 0, month: 5 })).toBe(0);
  });
});
