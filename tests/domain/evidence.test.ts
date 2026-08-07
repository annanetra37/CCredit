import { describe, expect, it } from "vitest";
import { hasValidEvidenceBasis } from "@/lib/domain/evidence";
import { canEnterLedger, recordOfAccountSource } from "@/lib/domain/sources";

const d = (s: string) => new Date(s);
const jan = d("2026-01-01");
const feb = d("2026-02-01");

describe("hasValidEvidenceBasis (R1 §7) — consent must cover the whole period", () => {
  it("active consent covering the period → true", () => {
    expect(
      hasValidEvidenceBasis(
        [{ signedAt: d("2025-06-01"), expiresAt: null, revokedAt: null }],
        jan,
        feb,
      ),
    ).toBe(true);
  });

  it("no consent at all → false (a period we have no right to sell)", () => {
    expect(hasValidEvidenceBasis([], jan, feb)).toBe(false);
  });

  it("consent signed mid-period → false", () => {
    expect(
      hasValidEvidenceBasis(
        [{ signedAt: d("2026-01-15"), expiresAt: null, revokedAt: null }],
        jan,
        feb,
      ),
    ).toBe(false);
  });

  it("consent revoked mid-period → false for that period", () => {
    expect(
      hasValidEvidenceBasis(
        [{ signedAt: d("2025-06-01"), expiresAt: null, revokedAt: d("2026-01-20") }],
        jan,
        feb,
      ),
    ).toBe(false);
  });

  it("revocation does not invalidate EARLIER periods", () => {
    expect(
      hasValidEvidenceBasis(
        [{ signedAt: d("2025-06-01"), expiresAt: null, revokedAt: d("2026-03-01") }],
        jan,
        feb,
      ),
    ).toBe(true);
  });

  it("renewal chain with no gap covers → true", () => {
    expect(
      hasValidEvidenceBasis(
        [
          { signedAt: d("2025-06-01"), expiresAt: d("2026-01-15"), revokedAt: null },
          { signedAt: d("2026-01-15"), expiresAt: null, revokedAt: null },
        ],
        jan,
        feb,
      ),
    ).toBe(true);
  });
});

describe("source ranking (R1 §4.1)", () => {
  it("ENA billing beats everything by default", () => {
    expect(recordOfAccountSource(["MANUAL", "ENA_BILLING", "INVERTER_API"])).toBe("ENA_BILLING");
  });

  it("a site can promote its own METER above ENA", () => {
    expect(
      recordOfAccountSource(["METER", "ENA_BILLING"], { METER: 0 }),
    ).toBe("METER");
  });

  it("no sources → null", () => {
    expect(recordOfAccountSource([])).toBeNull();
  });
});

describe("provisional figures can never enter the ledger (S3B-5)", () => {
  it("no adopted source → blocked", () => {
    expect(canEnterLedger(null).ok).toBe(false);
  });

  it("inverter data alone → blocked with an explanation", () => {
    const res = canEnterLedger("INVERTER_API");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("not evidence");
  });

  it("confirmed ENA record → allowed", () => {
    expect(canEnterLedger("ENA_BILLING").ok).toBe(true);
  });

  it("manual fallback → allowed (loudly badged elsewhere)", () => {
    expect(canEnterLedger("MANUAL").ok).toBe(true);
  });
});
