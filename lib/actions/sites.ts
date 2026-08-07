"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  validateSiteTransition,
  type SiteStatus,
} from "@/lib/domain/ledger/site-machine";

/** Zod schema shared client and server (definition of done). */
const siteWizardSchema = z.object({
  name: z.string().min(2),
  ownerLegalName: z.string().min(2),
  ownerTaxId: z.string().min(3),
  capacityKw: z.coerce.number().positive().max(100000),
  technology: z.string().default("SOLAR_PV"),
  inverterMake: z.string().optional(),
  inverterModel: z.string().optional(),
  moduleMake: z.string().optional(),
  moduleModel: z.string().optional(),
  tiltDeg: z.coerce.number().min(0).max(90).optional(),
  orientationDeg: z.coerce.number().min(0).max(360).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  address: z.string().optional(),
  isSandbox: z.coerce.boolean().default(false),
});

export async function createSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = siteWizardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/sites/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const data = parsed.data;

  const db = getDb();

  // Duplicate warning inputs (S1-2) are checked client-side pre-submit; the
  // owner tax ID match is re-checked here as the authoritative pass.
  let [owner] = await db
    .select()
    .from(tables.owners)
    .where(eq(tables.owners.taxId, data.ownerTaxId));
  if (!owner) {
    [owner] = await db
      .insert(tables.owners)
      .values({ legalName: data.ownerLegalName, taxId: data.ownerTaxId })
      .returning();
  }

  const [site] = await db
    .insert(tables.sites)
    .values({
      name: data.name,
      ownerId: owner!.id,
      capacityKw: String(data.capacityKw),
      technology: data.technology,
      inverterMake: data.inverterMake,
      inverterModel: data.inverterModel,
      moduleMake: data.moduleMake,
      moduleModel: data.moduleModel,
      tiltDeg: data.tiltDeg != null ? String(data.tiltDeg) : null,
      orientationDeg: data.orientationDeg != null ? String(data.orientationDeg) : null,
      lat: data.lat != null ? String(data.lat) : null,
      lon: data.lon != null ? String(data.lon) : null,
      address: data.address,
      isSandbox: data.isSandbox,
    })
    .returning();

  await writeAudit({
    actorId: user.id,
    action: "site.create",
    entityType: "site",
    entityId: site!.id,
    after: data,
  });

  redirect(`/sites/${site!.id}`);
}

export async function transitionSiteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = z.string().uuid().parse(formData.get("siteId"));
  const to = formData.get("to") as SiteStatus;
  const note = (formData.get("note") as string) || null;

  const db = getDb();
  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, siteId));
  if (!site) redirect("/sites");

  const check = validateSiteTransition(site.status, to);
  if (!check.ok) {
    redirect(`/sites/${siteId}?error=${encodeURIComponent(check.reason)}`);
  }

  await db.update(tables.sites).set({ status: to }).where(eq(tables.sites.id, siteId));
  await db.insert(tables.siteTransitions).values({
    siteId,
    fromStatus: site.status,
    toStatus: to,
    actorId: user.id,
    note,
  });
  await writeAudit({
    actorId: user.id,
    action: "site.transition",
    entityType: "site",
    entityId: siteId,
    before: { status: site.status },
    after: { status: to, note },
  });

  revalidatePath(`/sites/${siteId}`);
  redirect(`/sites/${siteId}`);
}

/** S1-4: sandbox flag changeable only by admin, with a written reason. */
export async function setSandboxAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/sites");

  const siteId = z.string().uuid().parse(formData.get("siteId"));
  const isSandbox = formData.get("isSandbox") === "true";
  const reason = z.string().min(10).parse(formData.get("reason"));

  const db = getDb();
  const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, siteId));
  if (!site) redirect("/sites");

  await db.update(tables.sites).set({ isSandbox }).where(eq(tables.sites.id, siteId));
  await writeAudit({
    actorId: user.id,
    action: "site.set_sandbox",
    entityType: "site",
    entityId: siteId,
    before: { isSandbox: site.isSandbox },
    after: { isSandbox, reason },
  });
  revalidatePath(`/sites/${siteId}`);
  redirect(`/sites/${siteId}`);
}
