/**
 * Nightly chain verification (S5-3): walks every device chain, recomputes
 * hashes, and raises a high-priority alert naming device, reading ID and
 * timestamp on any break. Results are stored so an auditor can see the
 * verification HISTORY, not just current state. The auditor console can also
 * trigger this on demand.
 */
import { asc, eq } from "drizzle-orm";
import { getDb, tables } from "@/lib/db";
import { verifyChain, type ChainBreak, type ChainReading } from "@/lib/domain/integrity/hash-chain";

export async function runChainVerification(
  triggeredBy: "schedule" | "auditor" | "ops" = "schedule",
): Promise<{ ok: boolean; breaks: ChainBreak[]; readingsChecked: number }> {
  const db = getDb();

  const [run] = await db
    .insert(tables.chainVerificationRuns)
    .values({ triggeredBy })
    .returning();

  const devices = await db.select({ id: tables.devices.id }).from(tables.devices);

  const allBreaks: ChainBreak[] = [];
  let readingsChecked = 0;

  for (const device of devices) {
    const rows = await db
      .select()
      .from(tables.readingRaw)
      .where(eq(tables.readingRaw.deviceId, device.id))
      .orderBy(asc(tables.readingRaw.ts));

    const chain: ChainReading[] = rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      ts: r.ts,
      intervalWh: r.intervalWh,
      source: r.source,
      prevHash: r.prevHash,
      hash: r.hash,
    }));

    readingsChecked += chain.length;
    allBreaks.push(...verifyChain(chain));
  }

  const ok = allBreaks.length === 0;

  await db
    .update(tables.chainVerificationRuns)
    .set({
      finishedAt: new Date(),
      devicesChecked: devices.length,
      readingsChecked,
      breaks: allBreaks,
      ok,
    })
    .where(eq(tables.chainVerificationRuns.id, run!.id));

  for (const b of allBreaks) {
    await db.insert(tables.alerts).values({
      kind: "CHAIN_BREAK",
      severity: "critical",
      deviceId: b.deviceId,
      message: `Hash chain break on device ${b.deviceId} at reading ${b.readingId} (${b.ts}): ${b.kind}. Historical data may have been tampered with.`,
      detail: b,
    });
  }

  return { ok, breaks: allBreaks, readingsChecked };
}
