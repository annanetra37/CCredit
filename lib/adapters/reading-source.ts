/**
 * The dual-source requirement (§1.2, S4-1).
 *
 * One interface all data sources implement, so hardware can be added later
 * without touching business logic. Manual entry is the FIRST implementation,
 * not a test hack: manual readings flow through exactly the same
 * reconciliation, ledger and calculation code as real ones.
 */

export type ReadingSourceKind = "MANUAL" | "METER" | "INVERTER_API";

export interface RawReading {
  deviceId: string;
  siteId: string;
  ts: Date;
  /** Cumulative meter register, when the instrument reports one. */
  registerWh: number | null;
  /** Energy generated in this interval. */
  intervalWh: number;
  source: ReadingSourceKind;
  /** Required when source = MANUAL — the operator who typed it. */
  enteredBy: string | null;
}

export interface ReadingSource {
  readonly kind: ReadingSourceKind;
  fetch(deviceId: string, from: Date, to: Date): Promise<RawReading[]>;
}
