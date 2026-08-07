import type { RawReading, ReadingSource } from "./reading-source";

/**
 * ManualSource (S4-1) — the first ReadingSource implementation.
 *
 * "Fetching" from the manual source returns what an operator typed. The entry
 * screen stages readings here (or the bulk importer does), and the ingestion
 * pipeline pulls them through the same path an MQTT gateway will use in
 * Sprint 13. Nothing downstream branches on the source type.
 */
export class ManualSource implements ReadingSource {
  readonly kind = "MANUAL" as const;

  constructor(private staged: RawReading[]) {
    for (const r of staged) {
      if (r.source !== "MANUAL") {
        throw new Error("ManualSource only carries MANUAL readings.");
      }
      if (!r.enteredBy) {
        throw new Error(
          "Every manual reading must record the operator who entered it.",
        );
      }
    }
  }

  async fetch(deviceId: string, from: Date, to: Date): Promise<RawReading[]> {
    return this.staged.filter(
      (r) => r.deviceId === deviceId && r.ts >= from && r.ts < to,
    );
  }
}
