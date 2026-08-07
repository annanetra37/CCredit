/**
 * Hash-chain verification (S5-2/S5-3). Mirrors the SQL trigger in
 * drizzle/0001_integrity.sql:
 *
 *   hash = sha256(prev_hash ‖ device_id ‖ epoch(ts) ‖ interval_wh ‖ source)
 *
 * Pure: the verification job feeds readings in chain order; this module
 * recomputes and reports the first break per device.
 */
import { createHash } from "node:crypto";

export interface ChainReading {
  id: number;
  deviceId: string;
  ts: Date;
  /** numeric column arrives as string from the driver; keep it exact */
  intervalWh: string;
  source: string;
  prevHash: Buffer | null;
  hash: Buffer;
}

export interface ChainBreak {
  deviceId: string;
  readingId: number;
  ts: string;
  kind: "hash_mismatch" | "link_mismatch";
}

export function computeReadingHash(
  prevHash: Buffer | null,
  deviceId: string,
  ts: Date,
  intervalWh: string,
  source: string,
): Buffer {
  // Postgres extract(epoch from ts) yields seconds with fractional part;
  // normalise the same way the trigger's ::text cast does.
  const epoch = ts.getTime() / 1000;
  const epochText = Number.isInteger(epoch) ? String(epoch) : String(epoch);
  return createHash("sha256")
    .update(Buffer.concat([
      prevHash ?? Buffer.alloc(0),
      Buffer.from(deviceId, "utf8"),
      Buffer.from(epochText, "utf8"),
      Buffer.from(intervalWh, "utf8"),
      Buffer.from(source, "utf8"),
    ]))
    .digest();
}

/**
 * Walk one device's chain (readings must be ordered by ts ascending).
 * Returns every break found — a break names device, reading ID and timestamp
 * so the alert is actionable.
 */
export function verifyChain(readings: ChainReading[]): ChainBreak[] {
  const breaks: ChainBreak[] = [];
  let expectedPrev: Buffer | null = null;

  for (const r of readings) {
    const prevMatches =
      (r.prevHash === null && expectedPrev === null) ||
      (r.prevHash !== null &&
        expectedPrev !== null &&
        r.prevHash.equals(expectedPrev));

    if (!prevMatches) {
      breaks.push({
        deviceId: r.deviceId,
        readingId: r.id,
        ts: r.ts.toISOString(),
        kind: "link_mismatch",
      });
    }

    const recomputed = computeReadingHash(
      r.prevHash,
      r.deviceId,
      r.ts,
      r.intervalWh,
      r.source,
    );
    if (!recomputed.equals(r.hash)) {
      breaks.push({
        deviceId: r.deviceId,
        readingId: r.id,
        ts: r.ts.toISOString(),
        kind: "hash_mismatch",
      });
    }

    expectedPrev = r.hash;
  }

  return breaks;
}
