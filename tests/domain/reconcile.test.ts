import { describe, expect, it } from "vitest";
import { reconcile } from "@/lib/domain/reconcile/reconcile";

describe("three-way reconciliation (S6-1)", () => {
  it("within tolerance → RECONCILED, meter adopted as record of account", () => {
    const r = reconcile({ meterMwh: 100, inverterMwh: 101, utilityMwh: 99.5 });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.adoptedSource).toBe("METER");
    expect(r.adoptedMwh).toBe(100);
    expect(r.fewerThanThreeSources).toBe(false);
  });

  it("a 6% variance → DISPUTED with no adopted value", () => {
    const r = reconcile({ meterMwh: 100, inverterMwh: 106, utilityMwh: 100 });
    expect(r.outcome).toBe("DISPUTED");
    expect(r.adoptedMwh).toBeNull();
    expect(r.maxVariancePct).toBeGreaterThan(2);
  });

  it("respects a per-site tolerance override", () => {
    const strict = reconcile({ meterMwh: 100, inverterMwh: 101.5, utilityMwh: 100, tolerancePct: 1 });
    expect(strict.outcome).toBe("DISPUTED");
    const loose = reconcile({ meterMwh: 100, inverterMwh: 106, utilityMwh: 100, tolerancePct: 10 });
    expect(loose.outcome).toBe("RECONCILED");
  });

  it("meter beats inverter even when inverter reads higher", () => {
    const r = reconcile({ meterMwh: 98, inverterMwh: 100, utilityMwh: null });
    expect(r.adoptedSource).toBe("METER");
    expect(r.adoptedMwh).toBe(98);
  });
});

describe("missing-source handling (S6-3)", () => {
  it("two sources reconcile with the absent source flagged", () => {
    const r = reconcile({ meterMwh: 50, inverterMwh: 50.4, utilityMwh: null });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.sourcesAbsent).toEqual(["UTILITY"]);
    expect(r.fewerThanThreeSources).toBe(true);
  });

  it("single source without supervisor approval → INSUFFICIENT_DATA", () => {
    const r = reconcile({ meterMwh: 42, inverterMwh: null, utilityMwh: null });
    expect(r.outcome).toBe("INSUFFICIENT_DATA");
    expect(r.reason).toContain("supervisor");
  });

  it("single source with supervisor approval reconciles", () => {
    const r = reconcile({
      meterMwh: 42,
      inverterMwh: null,
      utilityMwh: null,
      supervisorApproved: true,
    });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.adoptedMwh).toBe(42);
    expect(r.fewerThanThreeSources).toBe(true);
  });

  it("no sources at all → INSUFFICIENT_DATA", () => {
    const r = reconcile({ meterMwh: null, inverterMwh: null, utilityMwh: null });
    expect(r.outcome).toBe("INSUFFICIENT_DATA");
  });

  it("without a meter, utility beats inverter for adoption", () => {
    const r = reconcile({ meterMwh: null, inverterMwh: 100.5, utilityMwh: 100 });
    expect(r.adoptedSource).toBe("UTILITY");
  });

  it("zero generation across sources reconciles at zero variance", () => {
    const r = reconcile({ meterMwh: 0, inverterMwh: 0, utilityMwh: 0 });
    expect(r.outcome).toBe("RECONCILED");
    expect(r.maxVariancePct).toBe(0);
  });
});
