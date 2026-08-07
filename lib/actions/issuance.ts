"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  SandboxIssuanceBlockedError,
  getRegistryClient,
} from "@/lib/integrations/registry-client";

/**
 * S9-2: issue request builder. Volume comes from the attribute ledger — never
 * manually editable. The pre-submission checklist records every guard that
 * passed, and the registry client's sandbox gate runs regardless.
 */
export async function submitIssueRequestAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = z.string().uuid().parse(formData.get("siteId"));
  const attributeIds = z
    .array(z.string().uuid())
    .min(1)
    .parse(formData.getAll("attributeIds"));

  const db = getDb();
  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, siteId));
  if (!site) redirect("/issuance");

  const attrs = await db
    .select()
    .from(tables.attributes)
    .where(and(eq(tables.attributes.siteId, siteId), inArray(tables.attributes.id, attributeIds)));

  // Restricted to ALLOCATED status on the IREC track (S9-2).
  const notReady = attrs.filter((a) => a.status !== "ALLOCATED" || a.track !== "IREC");
  if (notReady.length > 0 || attrs.length !== attributeIds.length) {
    redirect(`/issuance?error=${encodeURIComponent("Only ALLOCATED attributes on the I-REC track can be issued. Deselect the rest.")}`);
  }

  const [registration] = await db
    .select()
    .from(tables.registryRegistrations)
    .where(and(eq(tables.registryRegistrations.siteId, siteId), eq(tables.registryRegistrations.status, "APPROVED")));

  const checklist = {
    allAllocated: true,
    allIrecTrack: true,
    registryRegistrationApproved: Boolean(registration),
    noSandboxAttributes: attrs.every((a) => !a.isSandbox),
    volumeFromLedger: true,
  };

  const totalMwh = attrs.reduce((s, a) => s + Number(a.mwh), 0);

  const [request] = await db
    .insert(tables.issueRequests)
    .values({
      siteId,
      status: "DRAFT",
      attributeIds,
      totalMwh: String(totalMwh),
      checklist,
      submittedBy: user.id,
    })
    .returning();

  if (!registration) {
    redirect(`/issuance?error=${encodeURIComponent("Site is not registered with the Issuer yet (or approval pending). The request was saved as a draft.")}`);
  }

  try {
    // The service-boundary gate: throws for ANY sandbox attribute, before any
    // network I/O, regardless of what this screen believes (§1.2).
    const client = getRegistryClient();
    const result = await client.submitIssueRequest({
      siteRegistryCode: registration.registryDeviceCode ?? "UNASSIGNED",
      periodLabel: new Date().toISOString().slice(0, 7),
      attributes: attrs.map((a) => ({ id: a.id, mwh: Number(a.mwh), isSandbox: a.isSandbox })),
      evidenceDocumentKeys: [],
    });

    for (const s of result.serials) {
      await db
        .update(tables.attributes)
        .set({ status: "ISSUED", serialNo: s.serialNo, issuedAt: new Date() })
        .where(eq(tables.attributes.id, s.attributeId));
      await db.insert(tables.attributeTransitions).values({
        attributeId: s.attributeId,
        fromStatus: "ALLOCATED",
        toStatus: "ISSUED",
        actorId: user.id,
        note: `Serial ${s.serialNo} via ${result.registryReference}`,
      });
      await db.insert(tables.certificateEvents).values({
        attributeId: s.attributeId,
        event: "ISSUED",
        detail: { serialNo: s.serialNo, registryReference: result.registryReference },
      });
    }

    await db
      .update(tables.issueRequests)
      .set({ status: "ISSUED", registryReference: result.registryReference, submittedAt: new Date() })
      .where(eq(tables.issueRequests.id, request!.id));

    await writeAudit({
      actorId: user.id,
      action: "issuance.submit",
      entityType: "issue_request",
      entityId: request!.id,
      after: { totalMwh, serials: result.serials.length, checklist },
    });

    redirect(`/issuance?issued=${result.serials.length}`);
  } catch (err) {
    if (err instanceof SandboxIssuanceBlockedError) {
      await db
        .update(tables.issueRequests)
        .set({ status: "REJECTED" })
        .where(eq(tables.issueRequests.id, request!.id));
      await writeAudit({
        actorId: user.id,
        action: "issuance.sandbox_blocked",
        entityType: "issue_request",
        entityId: request!.id,
        after: { offendingAttributeIds: err.offendingAttributeIds },
      });
      redirect(`/issuance?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}

/** S9-1: register a site with the Issuer; sandbox sites blocked at the boundary. */
export async function registerSiteWithIssuerAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = z.string().uuid().parse(formData.get("siteId"));
  const db = getDb();
  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, siteId));
  if (!site) redirect("/issuance");

  if (site.isSandbox) {
    redirect(`/issuance?error=${encodeURIComponent("Sandbox sites cannot be submitted to the Issuer. This block lives at the service boundary — no screen can bypass it.")}`);
  }

  const client = getRegistryClient();
  const { deviceCode } = await client.registerDevice({
    name: site.name,
    capacityKw: site.capacityKw,
    technology: site.technology,
    lat: site.lat,
    lon: site.lon,
  });

  await db.insert(tables.registryRegistrations).values({
    siteId,
    status: "APPROVED", // mock approves instantly; real Issuer flow: SUBMITTED → webhook
    registryDeviceCode: deviceCode,
    submittedAt: new Date(),
    decidedAt: new Date(),
  });

  await writeAudit({
    actorId: user.id,
    action: "registry.register_device",
    entityType: "site",
    entityId: siteId,
    after: { deviceCode },
  });

  redirect("/issuance");
}
