import { describe, expect, it } from "vitest";
import {
  ATTR_STATUSES,
  isLegalTransition,
  validateTransition,
  type AllocationGuardInput,
  type AttrStatus,
} from "@/lib/domain/ledger/attribute-machine";

const goodGuards: AllocationGuardInput = {
  periodStatus: "RECONCILED",
  contractValidAcrossPeriod: true,
  evidenceBasisValidAcrossPeriod: true,
  track: "IREC",
};

describe("attribute state machine — legal edges", () => {
  const legal: Array<[AttrStatus, AttrStatus]> = [
    ["MEASURED", "RECONCILED"],
    ["MEASURED", "DISPUTED"],
    ["RECONCILED", "ELIGIBLE"],
    ["DISPUTED", "RECONCILED"],
    ["ELIGIBLE", "ALLOCATED"],
    ["ALLOCATED", "ISSUED"],
    ["ALLOCATED", "ELIGIBLE"],
    ["ISSUED", "TRANSFERRED"],
    ["ISSUED", "REDEEMED"],
    ["TRANSFERRED", "REDEEMED"],
    ["MEASURED", "VOID"],
    ["RECONCILED", "VOID"],
  ];

  for (const [from, to] of legal) {
    it(`${from} → ${to} is legal`, () => {
      expect(isLegalTransition(from, to)).toBe(true);
    });
  }
});

describe("attribute state machine — every illegal edge rejected", () => {
  // Exhaustive: walk the full matrix and assert validateTransition agrees
  // with isLegalTransition, and that terminal states allow nothing.
  for (const from of ATTR_STATUSES) {
    for (const to of ATTR_STATUSES) {
      if (from === to) continue;
      if (isLegalTransition(from, to)) continue;
      it(`${from} → ${to} is rejected with a named reason`, () => {
        const res = validateTransition({ from, to, guards: goodGuards });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.reason).toContain(from);
      });
    }
  }

  it("REDEEMED is terminal and irreversible", () => {
    for (const to of ATTR_STATUSES) {
      if (to === "REDEEMED") continue;
      expect(isLegalTransition("REDEEMED", to)).toBe(false);
    }
  });
});

describe("ALLOCATED guards (S7-2)", () => {
  it("passes with all four guards satisfied", () => {
    expect(
      validateTransition({ from: "ELIGIBLE", to: "ALLOCATED", guards: goodGuards }),
    ).toEqual({ ok: true });
  });

  it("blocks when the period is not reconciled", () => {
    const res = validateTransition({
      from: "ELIGIBLE",
      to: "ALLOCATED",
      guards: { ...goodGuards, periodStatus: "DISPUTED" },
    });
    expect(res).toMatchObject({ ok: false, reasonKey: "period_not_reconciled" });
  });

  it("blocks when no contract covers the period", () => {
    const res = validateTransition({
      from: "ELIGIBLE",
      to: "ALLOCATED",
      guards: { ...goodGuards, contractValidAcrossPeriod: false },
    });
    expect(res).toMatchObject({ ok: false, reasonKey: "contract_invalid" });
  });

  it("blocks when the evidence basis (consent or calibration) lapses inside the period", () => {
    const res = validateTransition({
      from: "ELIGIBLE",
      to: "ALLOCATED",
      guards: { ...goodGuards, evidenceBasisValidAcrossPeriod: false },
    });
    expect(res).toMatchObject({ ok: false, reasonKey: "evidence_basis_invalid" });
  });

  it("blocks when no track is assigned", () => {
    const res = validateTransition({
      from: "ELIGIBLE",
      to: "ALLOCATED",
      guards: { ...goodGuards, track: "UNASSIGNED" },
    });
    expect(res).toMatchObject({ ok: false, reasonKey: "track_unassigned" });
  });

  it("blocks when guards are not supplied at all", () => {
    const res = validateTransition({ from: "ELIGIBLE", to: "ALLOCATED" });
    expect(res).toMatchObject({ ok: false, reasonKey: "guards_missing" });
  });
});
