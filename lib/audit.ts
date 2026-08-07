/**
 * Audit event infrastructure (S0-5). Every mutation writes an audit_event:
 * who, what, when, before, after. Read events are also logged for document
 * and evidence retrieval. A mutation without an audit write fails code
 * review — use this helper, don't insert ad hoc.
 */
import { getDb, tables } from "@/lib/db";

export interface AuditInput {
  actorId: string | null;
  action: string; // e.g. "site.create", "attribute.transition", "document.read"
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  const db = getDb();
  await db.insert(tables.auditEvents).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    ip: input.ip ?? null,
  });
}

/**
 * Wrap a mutation so the audit write and the change succeed or fail together
 * where the caller runs inside a transaction; otherwise best-effort ordering
 * with the audit write last.
 */
export async function withAudit<T>(
  input: AuditInput,
  mutation: () => Promise<T>,
): Promise<T> {
  const result = await mutation();
  await writeAudit(input);
  return result;
}
