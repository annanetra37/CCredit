import { describe, expect, it } from "vitest";
import { validateSiteTransition } from "@/lib/domain/ledger/site-machine";

describe("site lifecycle (S1-3)", () => {
  it("walks the happy path LEAD → … → PRODUCING", () => {
    const path = [
      "LEAD",
      "QUALIFYING",
      "CONTRACTED",
      "METERED",
      "COMMISSIONED",
      "ASSESSED",
      "PRODUCING",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(validateSiteTransition(path[i]!, path[i + 1]!)).toEqual({ ok: true });
    }
  });

  it("rejects skipping straight to PRODUCING", () => {
    const res = validateSiteTransition("LEAD", "PRODUCING");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("LEAD");
  });

  it("PRODUCING can be SUSPENDED (consent expiry, S2-4) and resumed", () => {
    expect(validateSiteTransition("PRODUCING", "SUSPENDED")).toEqual({ ok: true });
    expect(validateSiteTransition("SUSPENDED", "PRODUCING")).toEqual({ ok: true });
  });

  it("TERMINATED is final", () => {
    expect(validateSiteTransition("TERMINATED", "LEAD").ok).toBe(false);
    expect(validateSiteTransition("TERMINATED", "PRODUCING").ok).toBe(false);
  });
});
