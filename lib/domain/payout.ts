/**
 * Owner payout calculation (Sprint 10). Honours fixed-rate or revenue-share
 * terms and the retained share. Pure maths; currency in AMD.
 */

export interface PayoutTerms {
  paymentBasis: "FIXED_RATE" | "REVENUE_SHARE";
  ratePerMwhAmd?: number;
  revenueSharePct?: number;
  /** Share of attributes the owner keeps for their own claims — not paid out. */
  retainedSharePct: number;
}

export interface PayoutInput {
  mwh: number;
  /** Realised revenue for the period, needed for REVENUE_SHARE. */
  revenueAmd?: number;
  terms: PayoutTerms;
  deductionsAmd?: number;
}

export interface PayoutResult {
  payableMwh: number;
  grossAmd: number;
  deductionsAmd: number;
  netAmd: number;
}

export function calculatePayout(input: PayoutInput): PayoutResult {
  const { terms } = input;
  if (input.mwh < 0) throw new Error("MWh cannot be negative.");
  if (terms.retainedSharePct < 0 || terms.retainedSharePct > 100)
    throw new Error("Retained share must be between 0 and 100 percent.");

  const payableMwh = round4(input.mwh * (1 - terms.retainedSharePct / 100));

  let grossAmd: number;
  if (terms.paymentBasis === "FIXED_RATE") {
    if (terms.ratePerMwhAmd == null)
      throw new Error("Fixed-rate terms require ratePerMwhAmd.");
    grossAmd = round2(payableMwh * terms.ratePerMwhAmd);
  } else {
    if (terms.revenueSharePct == null)
      throw new Error("Revenue-share terms require revenueSharePct.");
    if (input.revenueAmd == null)
      throw new Error("Revenue-share payout requires the period's revenue.");
    const payableShare = input.mwh === 0 ? 0 : payableMwh / input.mwh;
    grossAmd = round2(
      input.revenueAmd * (terms.revenueSharePct / 100) * payableShare,
    );
  }

  const deductionsAmd = round2(input.deductionsAmd ?? 0);
  const netAmd = round2(grossAmd - deductionsAmd);
  return { payableMwh, grossAmd, deductionsAmd, netAmd };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
