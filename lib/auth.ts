/**
 * Authentication (S0-2): role-scoped access with database sessions,
 * individually revocable, and expiring auditor accounts.
 *
 * Deviation note (§2 requires a written reason): the build guide lists
 * Auth.js. This implements the same design — database sessions, revocable,
 * role-based — directly, because the whole auth surface here is ~150 lines
 * and auditors will read it; a hand-auditable session table beats a framework
 * indirection for a compliance product. Swapping to Auth.js later only
 * touches this file: the session table already matches its adapter shape.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, tables } from "@/lib/db";

export type Role =
  | "admin"
  | "ops"
  | "mrv_analyst"
  | "carbon_manager"
  | "commercial"
  | "field_tech"
  | "owner"
  | "vendor"
  | "auditor";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  ownerId: string | null;
  vendorId: string | null;
  sessionId: string;
}

const COOKIE = "portal_session";
const SESSION_TTL_HOURS = 12;

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function sealSessionId(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

export function unsealSessionId(sealed: string): string | null {
  const dot = sealed.lastIndexOf(".");
  if (dot === -1) return null;
  const id = sealed.slice(0, dot);
  const mac = sealed.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export type SignInResult =
  | { ok: true; sealedSession: string }
  | { ok: false; reason: "invalid_credentials" | "account_expired" | "account_disabled" };

export async function signIn(
  email: string,
  password: string,
  meta: { ip?: string; userAgent?: string },
): Promise<SignInResult> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.email, email.toLowerCase().trim()));

  if (!user || !(await compare(password, user.passwordHash))) {
    return { ok: false, reason: "invalid_credentials" };
  }
  if (user.disabledAt) return { ok: false, reason: "account_disabled" };
  // Auditor accounts support an expiry timestamp after which login fails.
  if (user.expiresAt && user.expiresAt < new Date()) {
    return { ok: false, reason: "account_expired" };
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);
  const [session] = await db
    .insert(tables.sessions)
    .values({
      userId: user.id,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    })
    .returning();

  await db.insert(tables.auditEvents).values({
    actorId: user.id,
    action: "auth.sign_in",
    entityType: "session",
    entityId: session!.id,
    ip: meta.ip ?? null,
  });

  return { ok: true, sealedSession: sealSessionId(session!.id) };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const sealed = store.get(COOKIE)?.value;
  if (!sealed) return null;
  const sessionId = unsealSessionId(sealed);
  if (!sessionId) return null;

  const db = getDb();
  const [row] = await db
    .select({ session: tables.sessions, user: tables.users })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .where(and(eq(tables.sessions.id, sessionId), isNull(tables.sessions.revokedAt)));

  if (!row) return null;
  if (row.session.expiresAt < new Date()) return null;
  if (row.user.disabledAt) return null;
  if (row.user.expiresAt && row.user.expiresAt < new Date()) return null;

  return {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    role: row.user.role,
    locale: row.user.locale,
    ownerId: row.user.ownerId,
    vendorId: row.user.vendorId,
    sessionId: row.session.id,
  };
}

export async function revokeSession(sessionId: string, actorId: string): Promise<void> {
  const db = getDb();
  await db
    .update(tables.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(tables.sessions.id, sessionId));
  await db.insert(tables.auditEvents).values({
    actorId,
    action: "auth.revoke_session",
    entityType: "session",
    entityId: sessionId,
  });
}

export const SESSION_COOKIE = COOKIE;

/** Role groups per route group (§2.1). */
export const ROUTE_ROLES: Record<string, Role[]> = {
  ops: ["admin", "ops", "mrv_analyst", "carbon_manager", "commercial", "field_tech"],
  owner: ["owner", "admin"],
  vendor: ["vendor", "admin"],
  auditor: ["auditor", "admin"],
};

export function canAccessGroup(role: Role, group: keyof typeof ROUTE_ROLES): boolean {
  return ROUTE_ROLES[group]?.includes(role) ?? false;
}
