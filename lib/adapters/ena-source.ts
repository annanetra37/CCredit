import type { RawReading, ReadingSource } from "./reading-source";

/**
 * EnaBillingSource (R1 Sprint 3B, S3B-2) — the new primary source adapter.
 *
 * One interface covers every way ENA data might arrive, so the access route
 * can change without rewriting the pipeline:
 *   Mode A — API / bulk feed (if ENA offers one)
 *   Mode B — bulk periodic export: scheduled file drop, matched by account no
 *   Mode C — per-site request: tracked request/response workflow
 *   Mode D — owner upload: the owner uploads their own bill (always available)
 *
 * All four modes converge on the SAME funnel: a parsed bill_extraction row
 * that a human analyst confirms (S3B-3 — extraction is never auto-accepted).
 * This adapter drains CONFIRMED extractions, so downstream code cannot tell
 * the modes apart — exactly the point. Implements the same ReadingSource
 * interface as ManualSource (Sprint 4); nothing downstream changes.
 */
export type EnaAcquisitionMode = "API" | "BULK_EXPORT" | "PER_SITE_REQUEST" | "OWNER_UPLOAD";

export class EnaBillingSource implements ReadingSource {
  readonly kind = "ENA_BILLING" as const;

  constructor(
    /** Fetches readings materialised from CONFIRMED bill extractions. */
    private confirmedReadings: (
      deviceId: string,
      from: Date,
      to: Date,
    ) => Promise<RawReading[]>,
  ) {}

  async fetch(deviceId: string, from: Date, to: Date): Promise<RawReading[]> {
    const readings = await this.confirmedReadings(deviceId, from, to);
    for (const r of readings) {
      if (r.source !== "ENA_BILLING") {
        throw new Error("EnaBillingSource only carries ENA_BILLING readings.");
      }
    }
    return readings;
  }
}
