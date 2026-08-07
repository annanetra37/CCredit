"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { parseBillCsv } from "@/lib/integrations/bill-parser";

/** S3B-1: record explicit data-release consent for a site. */
export async function recordConsentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schema = z.object({
    siteId: z.string().uuid(),
    signatoryName: z.string().min(2),
    expiresAt: z.string().optional(),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/ena?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const data = parsed.data;

  const db = getDb();
  const [consent] = await db
    .insert(tables.dataReleaseConsents)
    .values({
      siteId: data.siteId,
      signatoryName: data.signatoryName,
      signedAt: new Date(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    })
    .returning();

  await writeAudit({
    actorId: user.id,
    action: "ena.consent_recorded",
    entityType: "data_release_consent",
    entityId: consent!.id,
    after: data,
  });
  redirect("/ena");
}

/** S3B-1: revocation stops future acquisition; historic attributes stand. */
export async function revokeConsentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const consentId = z.string().uuid().parse(formData.get("consentId"));
  const reason = z.string().min(5).parse(formData.get("reason"));

  const db = getDb();
  await db
    .update(tables.dataReleaseConsents)
    .set({ revokedAt: new Date(), revocationReason: reason })
    .where(eq(tables.dataReleaseConsents.id, consentId));
  await writeAudit({
    actorId: user.id,
    action: "ena.consent_revoked",
    entityType: "data_release_consent",
    entityId: consentId,
    after: { reason },
  });
  redirect("/ena");
}

/**
 * S3B-2 Mode B/D: upload or paste bill data (CSV template). Parses rows into
 * the confirmation queue. Acquisition requires valid consent — guard enforced
 * here (and again at allocation via hasValidEvidenceBasis).
 */
export async function uploadBillAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const csv = z.string().min(5).parse(formData.get("csv"));
  const filename = (formData.get("filename") as string) || "pasted.csv";

  const db = getDb();
  const parsedRows = parseBillCsv(csv);
  if (parsedRows.length === 0) {
    redirect(`/ena?error=${encodeURIComponent("No parseable rows found in the upload.")}`);
  }

  let queued = 0;
  for (const row of parsedRows) {
    // Match to a site by ENA account number; unmatched rows are NOT
    // discarded — they land in the queue as unmatched exceptions (S3B-4).
    let siteId: string | null = null;
    if (row.enaAccountNumber) {
      const [site] = await db
        .select()
        .from(tables.sites)
        .where(eq(tables.sites.enaAccountNumber, row.enaAccountNumber));
      if (site) {
        siteId = site.id;
        // Consent guard: no valid consent, no acquisition (S3B-1).
        const consents = await db
          .select()
          .from(tables.dataReleaseConsents)
          .where(
            and(
              eq(tables.dataReleaseConsents.siteId, site.id),
              isNull(tables.dataReleaseConsents.revokedAt),
            ),
          );
        if (consents.length === 0) {
          redirect(
            `/ena?error=${encodeURIComponent(
              `Site "${site.name}" has no valid data-release consent. Record consent before acquiring ENA data.`,
            )}`,
          );
        }
      }
    }

    await db.insert(tables.billExtractions).values({
      siteId,
      enaAccountNumber: row.enaAccountNumber,
      filename,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      exportKwh: row.exportKwh != null ? String(row.exportKwh) : null,
      importKwh: row.importKwh != null ? String(row.importKwh) : null,
      tariff: row.tariff,
      confidence: String(row.confidence),
      originalValues: row,
    });
    queued++;
  }

  await writeAudit({
    actorId: user.id,
    action: "ena.bill_uploaded",
    entityType: "bill_extraction",
    after: { filename, rows: queued },
  });
  redirect(`/ena?queued=${queued}`);
}

/**
 * S3B-3: analyst confirms (or corrects) an extraction. Only now does the
 * figure become a reading — source ENA_BILLING, quantity EXPORT/IMPORT,
 * linked back to the extraction and its source document.
 */
export async function confirmExtractionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schema = z.object({
    extractionId: z.string().uuid(),
    exportKwh: z.coerce.number().min(0),
    importKwh: z.coerce.number().min(0).optional(),
    correctionReason: z.string().optional(),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/ena?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const data = parsed.data;

  const db = getDb();
  const [ext] = await db
    .select()
    .from(tables.billExtractions)
    .where(eq(tables.billExtractions.id, data.extractionId));
  if (!ext || ext.status !== "PENDING") redirect("/ena");
  if (!ext.siteId || !ext.periodStart || !ext.periodEnd) {
    redirect(`/ena?error=${encodeURIComponent("Extraction is unmatched or missing its period — correct the site/account first.")}`);
  }

  const corrected =
    ext.exportKwh != null && Number(ext.exportKwh) !== data.exportKwh;
  if (corrected && !data.correctionReason) {
    redirect(`/ena?error=${encodeURIComponent("Correcting an extracted value requires a reason.")}`);
  }

  const [meter] = await db
    .select()
    .from(tables.devices)
    .where(and(eq(tables.devices.siteId, ext.siteId), eq(tables.devices.type, "METER")));
  if (!meter) {
    redirect(`/ena?error=${encodeURIComponent("Site has no meter device registered — record the ENA meter serial first (identification only).")}`);
  }

  // Ensure the period exists; it may be AWAITING_SOURCE until now.
  let [period] = await db
    .select()
    .from(tables.periods)
    .where(
      and(
        eq(tables.periods.siteId, ext.siteId),
        eq(tables.periods.startsOn, ext.periodStart),
      ),
    );
  if (!period) {
    [period] = await db
      .insert(tables.periods)
      .values({
        siteId: ext.siteId,
        startsOn: ext.periodStart,
        endsOn: ext.periodEnd,
        status: "OPEN",
      })
      .returning();
  }

  const readingIds: number[] = [];
  const figures: Array<{ offsetMs: number; kwh: number | undefined; quantity: "EXPORT" | "IMPORT" }> = [
    { offsetMs: 4000, kwh: data.exportKwh, quantity: "EXPORT" },
    { offsetMs: 5000, kwh: data.importKwh, quantity: "IMPORT" },
  ];
  for (const f of figures) {
    if (f.kwh == null) continue;
    const [row] = await db
      .insert(tables.readingRaw)
      .values({
        deviceId: meter.id,
        siteId: ext.siteId,
        ts: new Date(ext.periodEnd.getTime() - f.offsetMs),
        intervalWh: String(f.kwh * 1000),
        source: "ENA_BILLING",
        quantity: f.quantity,
        enteredBy: user.id,
        hash: Buffer.alloc(0), // overwritten by the chain trigger
      })
      .onConflictDoNothing()
      .returning({ id: tables.readingRaw.id });
    if (row) readingIds.push(row.id);
  }

  await db
    .update(tables.billExtractions)
    .set({
      status: corrected ? "CORRECTED" : "CONFIRMED",
      exportKwh: String(data.exportKwh),
      importKwh: data.importKwh != null ? String(data.importKwh) : ext.importKwh,
      correctionReason: data.correctionReason ?? null,
      reviewedBy: user.id,
      reviewedAt: new Date(),
      readingIds,
    })
    .where(eq(tables.billExtractions.id, ext.id));

  // S3B-5: confirmed data replaces provisional — notify the owner.
  await db.insert(tables.alerts).values({
    kind: "ENA_DATA_CONFIRMED",
    severity: "info",
    siteId: ext.siteId,
    message: `Official ENA figure confirmed for ${ext.periodStart.toISOString().slice(0, 7)}: ${data.exportKwh} kWh exported. Provisional figures replaced.`,
  });

  await writeAudit({
    actorId: user.id,
    action: corrected ? "ena.extraction_corrected" : "ena.extraction_confirmed",
    entityType: "bill_extraction",
    entityId: ext.id,
    before: ext.originalValues,
    after: { exportKwh: data.exportKwh, importKwh: data.importKwh, readingIds },
  });

  redirect(`/reconciliation?period=${period!.id}`);
}

export async function rejectExtractionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const extractionId = z.string().uuid().parse(formData.get("extractionId"));
  const reason = z.string().min(5).parse(formData.get("reason"));

  const db = getDb();
  await db
    .update(tables.billExtractions)
    .set({ status: "REJECTED", correctionReason: reason, reviewedBy: user.id, reviewedAt: new Date() })
    .where(eq(tables.billExtractions.id, extractionId));
  await writeAudit({
    actorId: user.id,
    action: "ena.extraction_rejected",
    entityType: "bill_extraction",
    entityId: extractionId,
    after: { reason },
  });
  redirect("/ena");
}
