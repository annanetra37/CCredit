/**
 * Emission reduction calculation (S8-2), per functional spec §5 Module 12.
 *
 *   ER = (gross MWh − auxiliary MWh) × combined margin factor (tCO₂e/MWh)
 *
 * Net, not gross. The factor is looked up by VINTAGE date, never calculation
 * date, and never referenced as a constant in code — tests/architecture.test.ts
 * asserts the Armenian factor value appears only in the seed.
 */

export interface EmissionFactorVersion {
  id: string;
  cmTco2PerMwh: number;
  validFrom: Date;
  validTo: Date | null;
}

export interface EmissionCalcInput {
  grossMwh: number;
  auxiliaryMwh: number;
  factor: EmissionFactorVersion;
  /** Raw reading IDs behind the MWh figure — persisted for traceability. */
  inputReadingIds: number[];
}

export interface EmissionCalcResult {
  netMwh: number;
  tco2e: number;
  emissionFactorId: string;
  inputReadingIds: number[];
}

export function calculateEmissionReduction(
  input: EmissionCalcInput,
): EmissionCalcResult {
  if (input.grossMwh < 0) throw new Error("Gross MWh cannot be negative.");
  if (input.auxiliaryMwh < 0)
    throw new Error("Auxiliary consumption cannot be negative.");
  if (input.auxiliaryMwh > input.grossMwh)
    throw new Error("Auxiliary consumption cannot exceed gross generation.");
  if (input.inputReadingIds.length === 0)
    throw new Error(
      "A calculation must trace to its input readings — no orphan numbers.",
    );

  const netMwh = round4(input.grossMwh - input.auxiliaryMwh);
  const tco2e = round4(netMwh * input.factor.cmTco2PerMwh);

  return {
    netMwh,
    tco2e,
    emissionFactorId: input.factor.id,
    inputReadingIds: input.inputReadingIds,
  };
}

/**
 * Pick the factor version in force on the vintage date. Lookup is by vintage,
 * never by calculation date.
 */
export function factorForVintage(
  versions: EmissionFactorVersion[],
  vintageDate: Date,
): EmissionFactorVersion | null {
  return (
    versions.find(
      (v) =>
        v.validFrom <= vintageDate &&
        (v.validTo === null || v.validTo > vintageDate),
    ) ?? null
  );
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
