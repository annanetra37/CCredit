/**
 * Forward-only migration runner. Applies drizzle/NNNN_*.sql in order, records
 * each in schema_migrations, and refuses to continue if an applied file's
 * hash has changed (never edit an applied migration).
 *
 * Runs on DATABASE_ADMIN_URL because REVOKE/trigger DDL requires ownership.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      [
        "DATABASE_ADMIN_URL (or DATABASE_URL) must be set before migrations can run.",
        "On Railway: add a PostgreSQL service to the project, then on this service set",
        '  DATABASE_ADMIN_URL = ${{Postgres.DATABASE_URL}}   (variable reference)',
        '  DATABASE_URL       = ${{Postgres.DATABASE_URL}}   (or the app_user URL — see docs/DEPLOY_RAILWAY.md §2.3)',
        "  SESSION_SECRET     = a long random string",
        "  APP_ENV            = sandbox",
        "then redeploy. Full guide: docs/DEPLOY_RAILWAY.md",
      ].join("\n"),
    );
  }
  const sql = postgres(url, { max: 1, prepare: false });

  await sql`create table if not exists schema_migrations (
    filename text primary key,
    sha256 text not null,
    applied_at timestamptz not null default now()
  )`;

  const dir = path.join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  const applied = new Map<string, string>(
    (await sql`select filename, sha256 from schema_migrations`).map((r) => [
      r.filename as string,
      r.sha256 as string,
    ]),
  );

  for (const file of files) {
    const body = readFileSync(path.join(dir, file), "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
    const prior = applied.get(file);
    if (prior) {
      if (prior !== hash) {
        throw new Error(
          `${file} was edited after being applied. Migrations are forward-only — add a new file instead.`,
        );
      }
      continue;
    }
    console.log(`applying ${file}…`);
    await sql.unsafe(body);
    await sql`insert into schema_migrations (filename, sha256) values (${file}, ${hash})`;
  }

  await sql.end();
  console.log("migrations complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
