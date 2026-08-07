import { describe, expect, it } from "vitest";
import {
  calculateEmissionReduction,
  factorForVintage,
  type EmissionFactorVersion,
} from "@/lib/domain/calc/emission";

const armenia2026: EmissionFactorVersion = {
  id: "ef-am-2026",
  cmTco2PerMwh: 0.436,
  validFrom: new Date("2026-01-01"),
  validTo: null,
};

describe("emission reduction calculation (S8-2)", () => {
  it("net not gross: auxiliary consumption is deducted", () => {
    const r = calculateEmissionReduction({
      grossMwh: 100,
      auxiliaryMwh: 2,
      factor: armenia2026,
      inputReadingIds: [1, 2, 3],
    });
    expect(r.netMwh).toBe(98);
    expect(r.tco2e).toBeCloseTo(42.728, 4);
    expect(r.emissionFactorId).toBe("ef-am-2026");
  });

  it("persists the input reading IDs — no orphan numbers", () => {
    const r = calculateEmissionReduction({
      grossMwh: 10,
      auxiliaryMwh: 0,
      factor: armenia2026,
      inputReadingIds: [42],
    });
    expect(r.inputReadingIds).toEqual([42]);
  });

  it("refuses a calculation with no input readings", () => {
    expect(() =>
      calculateEmissionReduction({
        grossMwh: 10,
        auxiliaryMwh: 0,
        factor: armenia2026,
        inputReadingIds: [],
      }),
    ).toThrow(/trace/i);
  });

  it("refuses auxiliary greater than gross", () => {
    expect(() =>
      calculateEmissionReduction({
        grossMwh: 1,
        auxiliaryMwh: 2,
        factor: armenia2026,
        inputReadingIds: [1],
      }),
    ).toThrow();
  });
});

describe("factor lookup is by vintage, never calculation date (S8-1)", () => {
  const v1: EmissionFactorVersion = {
    id: "ef-v1",
    cmTco2PerMwh: 0.45,
    validFrom: new Date("2024-01-01"),
    validTo: new Date("2026-01-01"),
  };
  const v2: EmissionFactorVersion = {
    id: "ef-v2",
    cmTco2PerMwh: 0.436,
    validFrom: new Date("2026-01-01"),
    validTo: null,
  };

  it("a 2025 vintage uses the factor in force in 2025", () => {
    expect(factorForVintage([v1, v2], new Date("2025-07-15"))?.id).toBe("ef-v1");
  });

  it("a 2026 vintage uses the newer factor", () => {
    expect(factorForVintage([v1, v2], new Date("2026-07-15"))?.id).toBe("ef-v2");
  });

  it("a vintage before any factor returns null", () => {
    expect(factorForVintage([v1, v2], new Date("2020-01-01"))).toBeNull();
  });
});
