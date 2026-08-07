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
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: true, db: "not_configured" });
  }
  try {
    const sql = postgres(url, { max: 1, connect_timeout: 5, prepare: false });
    await sql`select 1`;
    await sql.end({ timeout: 2 });
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
