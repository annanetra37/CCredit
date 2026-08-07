import { describe, expect, it } from "vitest";
import { calculatePayout } from "@/lib/domain/payout";

describe("owner payout (Sprint 10)", () => {
  it("fixed rate honours the retained share", () => {
    const r = calculatePayout({
      mwh: 10,
      terms: {
        paymentBasis: "FIXED_RATE",
        ratePerMwhAmd: 5000,
        retainedSharePct: 10,
      },
    });
    expect(r.payableMwh).toBe(9);
    expect(r.grossAmd).toBe(45000);
    expect(r.netAmd).toBe(45000);
  });

  it("revenue share splits realised revenue", () => {
    const r = calculatePayout({
      mwh: 10,
      revenueAmd: 100000,
      terms: {
        paymentBasis: "REVENUE_SHARE",
        revenueSharePct: 60,
        retainedSharePct: 0,
      },
    });
    expect(r.grossAmd).toBe(60000);
  });

  it("deductions reduce net, never gross", () => {
    const r = calculatePayout({
      mwh: 10,
      deductionsAmd: 1500,
      terms: { paymentBasis: "FIXED_RATE", ratePerMwhAmd: 5000, retainedSharePct: 0 },
    });
    expect(r.grossAmd).toBe(50000);
    expect(r.netAmd).toBe(48500);
  });

  it("rejects impossible retained shares", () => {
    expect(() =>
      calculatePayout({
        mwh: 10,
        terms: { paymentBasis: "FIXED_RATE", ratePerMwhAmd: 1, retainedSharePct: 120 },
      }),
    ).toThrow();
  });

  it("revenue share without revenue is an error, not a zero", () => {
    expect(() =>
      calculatePayout({
        mwh: 10,
        terms: { paymentBasis: "REVENUE_SHARE", revenueSharePct: 50, retainedSharePct: 0 },
      }),
    ).toThrow();
  });
});
