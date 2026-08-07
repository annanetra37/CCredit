import { describe, expect, it } from "vitest";
import { hasValidCalibration } from "@/lib/domain/calibration";

const d = (s: string) => new Date(s);

describe("hasValidCalibration (S3-2)", () => {
  const jan = d("2026-01-01");
  const feb = d("2026-02-01");

  it("single certificate covering the whole period → true", () => {
    expect(
      hasValidCalibration(
        [{ validFrom: d("2025-06-01"), validTo: d("2026-06-01") }],
        jan,
        feb,
      ),
    ).toBe(true);
  });

  it("open-ended certificate (validTo null) covers → true", () => {
    expect(
      hasValidCalibration([{ validFrom: d("2025-06-01"), validTo: null }], jan, feb),
    ).toBe(true);
  });

  it("partial coverage at the start → false", () => {
    expect(
      hasValidCalibration(
        [{ validFrom: d("2026-01-15"), validTo: d("2026-06-01") }],
        jan,
        feb,
      ),
    ).toBe(false);
  });

  it("partial coverage at the end → false", () => {
    expect(
      hasValidCalibration(
        [{ validFrom: d("2025-06-01"), validTo: d("2026-01-20") }],
        jan,
        feb,
      ),
    ).toBe(false);
  });

  it("gap in the middle → false", () => {
    expect(
      hasValidCalibration(
        [
          { validFrom: d("2025-06-01"), validTo: d("2026-01-10") },
          { validFrom: d("2026-01-20"), validTo: d("2026-06-01") },
        ],
        jan,
        feb,
      ),
    ).toBe(false);
  });

  it("back-to-back certificates with no gap → true", () => {
    expect(
      hasValidCalibration(
        [
          { validFrom: d("2025-06-01"), validTo: d("2026-01-15") },
          { validFrom: d("2026-01-15"), validTo: d("2026-06-01") },
        ],
        jan,
        feb,
      ),
    ).toBe(true);
  });

  it("no calibration at all → false", () => {
    expect(hasValidCalibration([], jan, feb)).toBe(false);
  });

  it("unordered input is handled", () => {
    expect(
      hasValidCalibration(
        [
          { validFrom: d("2026-01-15"), validTo: d("2026-06-01") },
          { validFrom: d("2025-06-01"), validTo: d("2026-01-15") },
        ],
        jan,
        feb,
      ),
    ).toBe(true);
  });
});
