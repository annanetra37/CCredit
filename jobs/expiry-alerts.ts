/**
 * Daily expiry sweeps.
 *  - Calibration (S3-2): alerts at 90/30/7 days; on expiry the device is
 *    flagged — data keeps flowing but is non-issuable (the domain guard
 *    hasValidCalibration is what actually blocks allocation).
 *  - Consent (S2-4): alerts at 90/30/7 days of contract term end; on expiry
 *    the site transitions to SUSPENDED and attribute accrual stops. Historic
 *    attributes issued under the expired contract remain valid.
 */
import { and, eq, isNull } from "drizzle-orm";
import { getDb, tables } from "@/lib/db";
import { CALIBRATION_ALERT_DAYS, daysUntilExpiry } from "@/lib/domain/calibration";
import { validateSiteTransition } from "@/lib/domain/ledger/site-machine";
import { writeAudit } from "@/lib/audit";

const SYSTEM_ACTOR = null; // system-initiated; audit rows record actor null + action prefix

export async function runCalibrationAlerts(now = new Date()): Promise<number> {
  const db = getDb();
  const active = await db
    .select()
    .from(tables.calibrations)
    .where(isNull(tables.calibrations.supersededBy));

  let raised = 0;
  for (const cal of active) {
    const days = daysUntilExpiry({ validFrom: cal.validFrom, validTo: cal.validTo }, now);
    if (days === null) continue;
    if ((CALIBRATION_ALERT_DAYS as readonly number[]).includes(days) || days < 0) {
      await db.insert(tables.alerts).values({
        kind: "CALIBRATION_EXPIRY",
        severity: days < 0 ? "critical" : days <= 7 ? "warning" : "info",
        deviceId: cal.deviceId,
        message:
          days < 0
            ? `Calibration expired ${-days} day(s) ago. Data is still collected but is NON-ISSUABLE until recalibration.`
            : `Calibration expires in ${days} day(s). Book recalibration now to avoid an issuance gap.`,
        detail: { calibrationId: cal.id, daysUntilExpiry: days },
      });
      raised++;
    }
  }
  return raised;
}

export async function runConsentExpiry(now = new Date()): Promise<number> {
  const db = getDb();
  const contracts = await db
    .select()
    .from(tables.contracts)
    .where(and(isNull(tables.contracts.supersededBy), isNull(tables.contracts.validTo)));

  let actions = 0;
  for (const c of contracts) {
    if (!c.signedAt) continue;
    const termEnd = new Date(c.signedAt);
    termEnd.setMonth(termEnd.getMonth() + c.termMonths);
    const days = Math.floor((termEnd.getTime() - now.getTime()) / 86400000);

    if ([90, 30, 7].includes(days)) {
      await db.insert(tables.alerts).values({
        kind: "CONSENT_EXPIRY",
        severity: days <= 7 ? "warning" : "info",
        siteId: c.siteId,
        message: `Owner consent for this site lapses in ${days} day(s). Renew the agreement to keep attributes accruing.`,
        detail: { contractId: c.id, termEnd: termEnd.toISOString() },
      });
      actions++;
    }

    if (days < 0) {
      const [site] = await db
        .select()
        .from(tables.sites)
        .where(eq(tables.sites.id, c.siteId));
      if (site && site.status === "PRODUCING") {
        const check = validateSiteTransition(site.status, "SUSPENDED");
        if (check.ok) {
          await db
            .update(tables.sites)
            .set({ status: "SUSPENDED" })
            .where(eq(tables.sites.id, site.id));
          await db.insert(tables.siteTransitions).values({
            siteId: site.id,
            fromStatus: site.status,
            toStatus: "SUSPENDED",
            actorId: c.ownerId, // recorded against the counterparty; action names the system
            note: "Automatic suspension: consent lapsed (contract term ended).",
          });
          await writeAudit({
            actorId: SYSTEM_ACTOR,
            action: "system.consent_expiry.suspend",
            entityType: "site",
            entityId: site.id,
            before: { status: site.status },
            after: { status: "SUSPENDED", contractId: c.id },
          });
          await db.insert(tables.alerts).values({
            kind: "CONSENT_EXPIRY",
            severity: "critical",
            siteId: site.id,
            message:
              "Consent has lapsed. Site suspended; attribute accrual stopped. Historic attributes remain valid.",
            detail: { contractId: c.id },
          });
          actions++;
        }
      }
    }
  }
  return actions;
}

/** S9-4: warn when a period nears the Issuer's retrospective issuance window. */
export async function runIssuanceWindowMonitor(
  windowDays = 365,
  now = new Date(),
): Promise<number> {
  const db = getDb();
  const eligible = await db
    .select({
      attr: tables.attributes,
      period: tables.periods,
    })
    .from(tables.attributes)
    .innerJoin(tables.periods, eq(tables.attributes.periodId, tables.periods.id))
    .where(eq(tables.attributes.status, "ELIGIBLE"));

  let raised = 0;
  for (const row of eligible) {
    const deadline = new Date(row.period.endsOn.getTime() + windowDays * 86400000);
    const days = Math.floor((deadline.getTime() - now.getTime()) / 86400000);
    if ([60, 30, 14].includes(days)) {
      await db.insert(tables.alerts).values({
        kind: "ISSUANCE_WINDOW",
        severity: days <= 14 ? "warning" : "info",
        siteId: row.attr.siteId,
        message: `${row.attr.mwh} MWh must be issued within ${days} day(s) or the window closes and the revenue is lost.`,
        detail: { attributeId: row.attr.id, deadline: deadline.toISOString() },
      });
      raised++;
    }
  }
  return raised;
}
