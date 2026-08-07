"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

/**
 * Manual reading entry (S4-2). The three figures of a period — meter export,
 * inverter total, utility bill — are persisted as MANUAL readings on the
 * site's meter device (distinct timestamps inside the period close window so
 * the per-device hash chain stays strictly ordered), and the period is
 * created OPEN, ready for reconciliation.
 *
 * Available only on sandbox sites unless the user holds the admin role.
 */
const manualEntrySchema = z.object({
  siteId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  meterMwh: z.coerce.number().min(0),
  inverterMwh: z.coerce.number().min(0).optional(),
  utilityMwh: z.coerce.number().min(0).optional(),
  auxiliaryMwh: z.coerce.number().min(0).optional(),
});

export async function manualEntryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = manualEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/readings/manual?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const data = parsed.data;

  const db = getDb();
  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, data.siteId));
  if (!site) redirect("/readings/manual?error=unknown+site");

  // The manual path is for exercising the pipeline: sandbox sites for
  // everyone with entry rights, production sites only for admins (§9).
  if (!site.isSandbox && user.role !== "admin") {
    redirect("/readings/manual?error=" + encodeURIComponent("Manual entry on production sites requires the admin role."));
  }

  const [meter] = await db
    .select()
    .from(tables.devices)
    .where(and(eq(tables.devices.siteId, site.id), eq(tables.devices.type, "METER")));
  if (!meter) {
    redirect("/readings/manual?error=" + encodeURIComponent("This site has no meter device registered yet — register one first (Devices)."));
  }

  const [y, m] = data.month.split("-").map(Number);
  const startsOn = new Date(Date.UTC(y!, m! - 1, 1));
  const endsOn = new Date(Date.UTC(y!, m!, 1));

  let [period] = await db
    .select()
    .from(tables.periods)
    .where(and(eq(tables.periods.siteId, site.id), eq(tables.periods.startsOn, startsOn)));
  if (!period) {
    [period] = await db
      .insert(tables.periods)
      .values({ siteId: site.id, startsOn, endsOn })
      .returning();
  }

  // Three roles → three distinct close-of-period timestamps, so the unique
  // (device, ts, source) index distinguishes them and the chain stays ordered.
  const figures: Array<{ offsetMs: number; mwh: number | undefined; role: string }> = [
    { offsetMs: 1000, mwh: data.meterMwh, role: "meter" },
    { offsetMs: 2000, mwh: data.inverterMwh, role: "inverter" },
    { offsetMs: 3000, mwh: data.utilityMwh, role: "utility" },
  ];

  const readingIds: Record<string, number> = {};
  for (const f of figures) {
    if (f.mwh == null) continue;
    const ts = new Date(endsOn.getTime() - f.offsetMs);
    const [row] = await db
      .insert(tables.readingRaw)
      .values({
        deviceId: meter.id,
        siteId: site.id,
        ts,
        intervalWh: String(f.mwh * 1_000_000),
        source: "MANUAL",
        enteredBy: user.id,
        // hash/prevHash are computed by the database trigger; the values
        // here are placeholders the trigger overwrites.
        hash: Buffer.alloc(0),
      })
      .onConflictDoNothing()
      .returning({ id: tables.readingRaw.id });
    if (row) readingIds[f.role] = row.id;
  }

  await writeAudit({
    actorId: user.id,
    action: "reading.manual_entry",
    entityType: "period",
    entityId: period!.id,
    after: { ...data, readingIds, auxiliaryMwh: data.auxiliaryMwh ?? 0 },
  });

  redirect(`/reconciliation?period=${period!.id}`);
}

/**
 * Bulk manual import (S4-3): CSV of `month,meter_mwh,inverter_mwh,utility_mwh`.
 * All rows commit or none do; the batch is one audit event with row count and
 * file hash.
 */
export async function bulkImportAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = z.string().uuid().parse(formData.get("siteId"));
  const csv = z.string().min(1).parse(formData.get("csv"));

  const db = getDb();
  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, siteId));
  if (!site) redirect("/readings/import?error=unknown+site");
  if (!site.isSandbox && user.role !== "admin") {
    redirect("/readings/import?error=" + encodeURIComponent("Bulk import on production sites requires the admin role."));
  }

  const [meter] = await db
    .select()
    .from(tables.devices)
    .where(and(eq(tables.devices.siteId, site.id), eq(tables.devices.type, "METER")));
  if (!meter) {
    redirect("/readings/import?error=" + encodeURIComponent("This site has no meter device registered."));
  }

  const lines = csv.trim().split(/\r?\n/);
  const rows: Array<{ month: string; meter: number; inverter?: number; utility?: number }> = [];
  const rejected: Array<{ line: number; reason: string }> = [];

  lines.forEach((line, i) => {
    if (i === 0 && /month/i.test(line)) return; // header
    const [month, meterS, inverterS, utilityS] = line.split(",").map((s) => s?.trim());
    const rowSchema = z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      meter: z.coerce.number().min(0),
      inverter: z.coerce.number().min(0).optional(),
      utility: z.coerce.number().min(0).optional(),
    });
    const parsed = rowSchema.safeParse({
      month,
      meter: meterS,
      inverter: inverterS || undefined,
      utility: utilityS || undefined,
    });
    if (!parsed.success) {
      rejected.push({ line: i + 1, reason: parsed.error.issues[0]?.message ?? "invalid" });
    } else {
      rows.push(parsed.data);
    }
  });

  // Partial import is not possible — all rows commit or none do.
  if (rejected.length > 0) {
    redirect(
      `/readings/import?error=${encodeURIComponent(
        `Import refused: ${rejected.length} bad row(s), first at line ${rejected[0]!.line} (${rejected[0]!.reason}). Fix the file and retry — partial imports are not allowed.`,
      )}`,
    );
  }

  await db.transaction(async (tx) => {
    for (const r of rows) {
      const [y, m] = r.month.split("-").map(Number);
      const startsOn = new Date(Date.UTC(y!, m! - 1, 1));
      const endsOn = new Date(Date.UTC(y!, m!, 1));
      await tx
        .insert(tables.periods)
        .values({ siteId: site.id, startsOn, endsOn })
        .onConflictDoNothing();

      const figures = [
        { offsetMs: 1000, mwh: r.meter },
        { offsetMs: 2000, mwh: r.inverter },
        { offsetMs: 3000, mwh: r.utility },
      ];
      for (const f of figures) {
        if (f.mwh == null) continue;
        await tx
          .insert(tables.readingRaw)
          .values({
            deviceId: meter.id,
            siteId: site.id,
            ts: new Date(endsOn.getTime() - f.offsetMs),
            intervalWh: String(f.mwh * 1_000_000),
            source: "MANUAL",
            enteredBy: user.id,
            hash: Buffer.alloc(0),
          })
          .onConflictDoNothing();
      }
    }
  });

  await writeAudit({
    actorId: user.id,
    action: "reading.bulk_import",
    entityType: "site",
    entityId: site.id,
    after: {
      rowCount: rows.length,
      fileSha256: createHash("sha256").update(csv).digest("hex"),
    },
  });

  redirect(`/reconciliation`);
}
