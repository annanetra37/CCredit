import { describe, expect, it } from "vitest";
import { parseBillCsv, parseBillText } from "@/lib/integrations/bill-parser";

describe("ENA bill CSV parsing (S3B-3)", () => {
  it("parses a clean row with full confidence", () => {
    const rows = parseBillCsv(
      "account_number,period_start,period_end,export_kwh,import_kwh,tariff\n0012345678,2026-01-01,2026-02-01,3200,1450,day-night",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      enaAccountNumber: "0012345678",
      exportKwh: 3200,
      importKwh: 1450,
      confidence: 1,
    });
  });

  it("malformed account lowers confidence and records a warning — never a silent accept", () => {
    const rows = parseBillCsv("ABC,2026-01-01,2026-02-01,3200,,");
    expect(rows[0]!.enaAccountNumber).toBeNull();
    expect(rows[0]!.confidence).toBeLessThan(0.7);
    expect(rows[0]!.warnings.length).toBeGreaterThan(0);
  });

  it("inverted period dates are flagged", () => {
    const rows = parseBillCsv("0012345678,2026-02-01,2026-01-01,3200,,");
    expect(rows[0]!.warnings.some((w) => w.includes("period"))).toBe(true);
  });
});

describe("ENA bill text parsing", () => {
  it("extracts labelled figures from bill-like text", () => {
    const parsed = parseBillText(
      "ENA account 0012345678 period 2026-01-01 2026-02-01 Export 3 200 kWh Import 1 450 kWh",
    );
    expect(parsed.enaAccountNumber).toBe("0012345678");
    expect(parsed.exportKwh).toBe(3200);
    expect(parsed.importKwh).toBe(1450);
  });

  it("a bill without a separated export figure warns loudly — this is the serious failure mode", () => {
    const parsed = parseBillText("account 0012345678 total consumption 4650 kWh");
    expect(parsed.exportKwh).toBeNull();
    expect(parsed.warnings.some((w) => w.includes("export"))).toBe(true);
  });
});
