import type { RawReading, ReadingSource } from "./reading-source";

/**
 * MqttSource (Sprint 13) — real hardware ingestion.
 *
 * Devices push over MQTT (EMQX, per-device X.509 certificates); the platform
 * never polls. The broker consumer lands messages in a buffer table; this
 * adapter drains that buffer through the SAME interface manual entry uses.
 * Duplicate suppression on (device_id, ts, source) is the database's unique
 * index — replayed store-and-forward messages simply no-op.
 *
 * The broker consumer itself lives in jobs/mqtt-consumer.ts and is only
 * started in environments where EMQX is configured.
 */
export class MqttSource implements ReadingSource {
  readonly kind = "METER" as const;

  constructor(
    private drainBuffer: (
      deviceId: string,
      from: Date,
      to: Date,
    ) => Promise<RawReading[]>,
  ) {}

  async fetch(deviceId: string, from: Date, to: Date): Promise<RawReading[]> {
    return this.drainBuffer(deviceId, from, to);
  }
}
