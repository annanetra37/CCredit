import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

/**
 * Railway healthcheck endpoint. 200 when the app is up and the database
 * answers; 503 when a configured database is unreachable (so a bad deploy is
 * rolled back instead of serving errors). With no DATABASE_URL configured the
 * app still reports healthy-but-degraded — the UI runs on the compiled
 * glossary seed, which is deliberate for first-boot before the DB is wired.
 */
export async function GET() {
  // Config sanity: name exactly what is missing so a broken deploy explains
  // itself instead of failing at the login screen.
  const missing: string[] = [];
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET (required — login cannot work without it)");
  if (!process.env.APP_ENV) missing.push("APP_ENV (recommended: sandbox | production)");

  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: true, db: "not_configured", missing });
  }
  try {
    const sql = postgres(url, { max: 1, connect_timeout: 5, prepare: false });
    const [row] = await sql`select count(*)::int as n from app_account`;
    await sql.end({ timeout: 2 });
    const accounts = row?.n ?? 0;
    if (accounts === 0) {
      missing.push("no accounts in the database — run `npm run db:seed` (it now also runs automatically on deploy)");
    }
    return NextResponse.json({ ok: true, db: "up", accounts, missing });
  } catch {
    return NextResponse.json({ ok: false, db: "down", missing }, { status: 503 });
  }
}
