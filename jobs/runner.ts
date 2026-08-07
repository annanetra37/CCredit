/**
 * Job runner — pg-boss, Postgres-backed (one less service to run).
 * Start with: npm run jobs
 */
import PgBoss from "pg-boss";
import { runChainVerification } from "./verify-chains";
import {
  runCalibrationAlerts,
  runConsentExpiry,
  runIssuanceWindowMonitor,
} from "./expiry-alerts";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");

  const boss = new PgBoss(url);
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();

  const queues: Array<{ name: string; cron: string; handler: () => Promise<unknown> }> = [
    // Nightly, 01:00 Yerevan time (21:00 UTC): walk every hash chain.
    { name: "verify-chains", cron: "0 21 * * *", handler: () => runChainVerification("schedule") },
    // Daily sweeps.
    { name: "calibration-alerts", cron: "0 4 * * *", handler: () => runCalibrationAlerts() },
    { name: "consent-expiry", cron: "15 4 * * *", handler: () => runConsentExpiry() },
    { name: "issuance-window", cron: "30 4 * * *", handler: () => runIssuanceWindowMonitor() },
  ];

  for (const q of queues) {
    await boss.createQueue(q.name);
    await boss.schedule(q.name, q.cron);
    await boss.work(q.name, async () => {
      console.log(`[jobs] ${q.name} starting`);
      const result = await q.handler();
      console.log(`[jobs] ${q.name} done`, result);
    });
  }

  console.log("[jobs] runner started with queues:", queues.map((q) => q.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
