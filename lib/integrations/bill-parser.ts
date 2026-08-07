/**
 * ENA bill parsing (R1 S3B-3). Extracts account number, period, export kWh,
 * import kWh and tariff from CSV or text-extractable PDF bills, with a
 * confidence score. Extraction is NEVER auto-accepted — the caller writes a
 * bill_extraction row and a human confirms, corrects or rejects (low
 * confidence sorts to the top of the queue).
 *
 * The exact ENA formats are established by the Section 2.2 pilot; this
 * parser handles the CSV template we issue for Mode B/D uploads plus a
 * heuristic pass over text PDFs, and is the single place format knowledge
 * lives — new formats extend this module only.
 */

export interface ParsedBill {
  enaAccountNumber: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  exportKwh: number | null;
  importKwh: number | null;
  tariff: string | null;
  /** 0..1 — how many fields extracted cleanly. */
  confidence: number;
  warnings: string[];
}

/**
 * CSV template: header row then one record —
 *   account_number,period_start,period_end,export_kwh,import_kwh,tariff
 *   0012345678,2026-01-01,2026-02-01,3200,1450,day-night
 */
export function parseBillCsv(csv: string): ParsedBill[] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  const out: ParsedBill[] = [];

  for (const [i, line] of lines.entries()) {
    if (i === 0 && /account/i.test(line)) continue;
    const [account, start, end, exportS, importS, tariff] = line
      .split(",")
      .map((s) => s?.trim());

    const warnings: string[] = [];
    let score = 0;

    const enaAccountNumber = account && /^\d{6,12}$/.test(account) ? account : null;
    if (enaAccountNumber) score += 1;
    else warnings.push(`row ${i + 1}: account number missing or malformed`);

    const periodStart = parseDate(start);
    const periodEnd = parseDate(end);
    if (periodStart && periodEnd && periodEnd > periodStart) score += 1;
    else warnings.push(`row ${i + 1}: period dates missing or inverted`);

    const exportKwh = parseNumber(exportS);
    if (exportKwh != null && exportKwh >= 0) score += 1;
    else warnings.push(`row ${i + 1}: export kWh missing`);

    const importKwh = parseNumber(importS);
    if (importKwh != null) score += 0.5;

    out.push({
      enaAccountNumber,
      periodStart,
      periodEnd,
      exportKwh,
      importKwh,
      tariff: tariff || null,
      confidence: Math.min(1, round3(score / 3.5)),
      warnings,
    });
  }
  return out;
}

/**
 * Heuristic extraction from PDF-derived text (or any pasted bill text).
 * Looks for labelled figures in Armenian/Russian/English bill layouts.
 */
export function parseBillText(text: string): ParsedBill {
  const warnings: string[] = [];
  let score = 0;

  const account =
    match(text, /(?:account|аբոնենտ|абонент|hashiv|հաշիվ)\D{0,20}(\d{6,12})/i) ??
    match(text, /\b(\d{10})\b/);
  if (account) score += 1;
  else warnings.push("account number not found");

  const dates = [...text.matchAll(/(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/g)].map(
    (m) => parseDate(m[1]),
  );
  const periodStart = dates[0] ?? null;
  const periodEnd = dates[1] ?? null;
  if (periodStart && periodEnd && periodEnd > periodStart) score += 1;
  else warnings.push("billing period not found");

  const exportKwh = parseNumber(
    match(text, /(?:export|արտահանում|выдано|отпущено)\D{0,25}([\d\s.,]+)\s*(?:kwh|կվտ)/i),
  );
  if (exportKwh != null) score += 1;
  else warnings.push("export figure not found — is this bill export/import separated?");

  const importKwh = parseNumber(
    match(text, /(?:import|ներմուծում|потреблено|получено)\D{0,25}([\d\s.,]+)\s*(?:kwh|կվտ)/i),
  );
  if (importKwh != null) score += 0.5;

  return {
    enaAccountNumber: account,
    periodStart,
    periodEnd,
    exportKwh,
    importKwh,
    tariff: null,
    confidence: Math.min(1, round3(score / 3.5)),
    warnings,
  };
}

function match(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1] ?? null;
}

function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Date.UTC(+iso[1]!, +iso[2]! - 1, +iso[3]!));
  const eu = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
  if (eu) return new Date(Date.UTC(+eu[3]!, +eu[2]! - 1, +eu[1]!));
  return null;
}

function parseNumber(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
