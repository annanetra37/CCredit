import { describe, expect, it } from "vitest";
import {
  computeReadingHash,
  verifyChain,
  type ChainReading,
} from "@/lib/domain/integrity/hash-chain";

function buildChain(count: number): ChainReading[] {
  const readings: ChainReading[] = [];
  let prev: Buffer | null = null;
  for (let i = 0; i < count; i++) {
    const ts = new Date(Date.UTC(2026, 0, 1, i));
    const intervalWh = String(1000 + i);
    const hash = computeReadingHash(prev, "dev-1", ts, intervalWh, "MANUAL");
    readings.push({
      id: i + 1,
      deviceId: "dev-1",
      ts,
      intervalWh,
      source: "MANUAL",
      prevHash: prev,
      hash,
    });
    prev = hash;
  }
  return readings;
}

describe("hash chain verification (S5-2/S5-3)", () => {
  it("an intact chain verifies with zero breaks", () => {
    expect(verifyChain(buildChain(10))).toEqual([]);
  });

  it("corrupting a payload is detected at that reading", () => {
    const chain = buildChain(10);
    chain[4]!.intervalWh = "999999"; // superuser edit — the fraud scenario
    const breaks = verifyChain(chain);
    expect(breaks.length).toBeGreaterThan(0);
    expect(breaks[0]).toMatchObject({ readingId: 5, kind: "hash_mismatch" });
  });

  it("splicing a chain (rewriting a hash) breaks the next link", () => {
    const chain = buildChain(5);
    chain[2]!.hash = computeReadingHash(
      chain[2]!.prevHash,
      "dev-1",
      chain[2]!.ts,
      "31337",
      "MANUAL",
    );
    const breaks = verifyChain(chain);
    // reading 3's stored payload no longer matches its hash, and reading 4's
    // prev link no longer matches reading 3's original hash
    expect(breaks.some((b) => b.readingId === 3 && b.kind === "hash_mismatch")).toBe(true);
    expect(breaks.some((b) => b.readingId === 4 && b.kind === "link_mismatch")).toBe(true);
  });

  it("a deleted first reading is detected as a seed mismatch", () => {
    const chain = buildChain(3).slice(1); // drop the genesis reading
    const breaks = verifyChain(chain);
    expect(breaks[0]).toMatchObject({ readingId: 2, kind: "link_mismatch" });
  });

  it("an empty chain verifies trivially", () => {
    expect(verifyChain([])).toEqual([]);
  });
});
