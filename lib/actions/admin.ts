"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser, revokeSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { runChainVerification } from "@/jobs/verify-chains";

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/");
  const sessionId = z.string().uuid().parse(formData.get("sessionId"));
  await revokeSession(sessionId, user.id);
  redirect("/admin/sessions");
}

/** S0-4: glossary content editable by non-engineers without a deploy. */
export async function upsertGlossaryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !["admin", "ops"].includes(user.role)) redirect("/");

  const schema = z.object({
    key: z.string().min(2).regex(/^[a-z0-9_]+$/),
    locale: z.enum(["hy", "en"]),
    term: z.string().min(1),
    short: z.string().min(1),
    eli5: z.string().min(10),
    whyItMatters: z.string().min(10),
    example: z.string().optional(),
    groupKey: z.enum(["attributes", "carbon", "measurement", "roles", "system"]),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin/glossary?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const data = parsed.data;

  const db = getDb();
  await db
    .insert(tables.glossaryEntries)
    .values({
      key: data.key,
      locale: data.locale,
      term: data.term,
      short: data.short,
      eli5: data.eli5,
      whyItMatters: data.whyItMatters,
      example: data.example || null,
      groupKey: data.groupKey,
      updatedBy: user.id,
    })
    .onConflictDoUpdate({
      target: [tables.glossaryEntries.key, tables.glossaryEntries.locale],
      set: {
        term: data.term,
        short: data.short,
        eli5: data.eli5,
        whyItMatters: data.whyItMatters,
        example: data.example || null,
        groupKey: data.groupKey,
        updatedBy: user.id,
        updatedAt: new Date(),
      },
    });

  await writeAudit({
    actorId: user.id,
    action: "glossary.upsert",
    entityType: "glossary_entry",
    entityId: `${data.key}:${data.locale}`,
    after: data,
  });

  redirect("/admin/glossary");
}

/** S5-3 / Sprint 12: on-demand chain verification (ops or auditor). */
export async function triggerChainVerificationAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const by = user.role === "auditor" ? "auditor" : "ops";
  await runChainVerification(by);
  await writeAudit({
    actorId: user.id,
    action: "integrity.verify_chains",
    entityType: "chain_verification_run",
  });
  redirect(user.role === "auditor" ? "/console" : "/audit");
}
