# Deploying to Railway

The repo ships Railway config-as-code: `railway.json` (web service) and
`railway.jobs.json` (worker). A deploy is three services in one project:

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐
│  portal-web │──▶│   postgres   │◀──│ portal-jobs  │
│  Next.js    │   │ (TimescaleDB)│   │ pg-boss cron │
└─────────────┘   └──────────────┘   └──────────────┘
```

## 1. Database service

Two options:

- **TimescaleDB (recommended, matches the build guide):** add a new service
  from Docker image `timescale/timescaledb:latest-pg16`. Set
  `POSTGRES_PASSWORD` and note the generated connection details.
- **Railway's managed Postgres:** works too — the migration guards the
  `create_hypertable` call, so `reading_raw` falls back to a plain table.
  Fine for a demo; use TimescaleDB before real meter volumes arrive.

## 2. Web service (`portal-web`)

1. New service → **Deploy from GitHub repo** → pick this repo/branch.
   Railway reads `railway.json` automatically: build `npm run build`,
   pre-deploy `npm run db:migrate`, start `npm run start`, healthcheck
   `/api/health`.
2. Variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_ADMIN_URL` | the Postgres superuser URL (use a Railway reference, e.g. `${{Postgres.DATABASE_URL}}`) — used only by the pre-deploy migration |
   | `DATABASE_URL` | the **app_user** URL (see step 3) — what the app itself connects with |
   | `SESSION_SECRET` | 32+ random bytes (`openssl rand -base64 48`) |
   | `APP_ENV` | `sandbox` first; flip to `production` at go-live (drives the coloured strip) |
   | `REGISTRY_MODE` | `mock` until Issuer credentials exist, then `sandbox`/live URL + `REGISTRY_API_URL`, `REGISTRY_API_KEY` |
   | `S3_ENDPOINT` etc. | optional; without them the vault writes to local disk (ephemeral on Railway — configure object storage before storing real documents) |

3. **The two-URL setup matters.** Append-only enforcement works because the
   app connects as `app_user`, a role that *cannot* UPDATE/DELETE readings.
   The first migration creates that role with a dev password. After the first
   deploy, set a real one and point `DATABASE_URL` at it:

   ```bash
   railway connect postgres   # or any psql to the DB
   ALTER ROLE app_user PASSWORD 'a-long-random-password';
   ```

   Then `DATABASE_URL=postgres://app_user:a-long-random-password@<same-host>:<port>/<same-db>`.
   (Shortcut for a throwaway demo: set `DATABASE_URL` to the superuser URL —
   everything runs, but the append-only REVOKE is not exercised.)

4. First deploy runs migrations automatically (pre-deploy command). Seed once:

   ```bash
   railway run --service portal-web npm run db:seed             # glossary, demo users, AM factor
   railway run --service portal-web npm run db:seed-scenarios   # 5 sandbox demo sites
   ```

5. Open the URL → log in as `admin@portal.am` / `portal-demo` (change or
   delete demo accounts before real use).

## 3. Jobs service (`portal-jobs`)

Same repo as a second service, with **Config file path** set to
`railway.jobs.json` in the service settings (Settings → Config-as-code).
Give it the same `DATABASE_URL` (+`SESSION_SECRET` if jobs ever send
notifications). It runs pg-boss with the nightly chain verification and the
daily calibration / consent / issuance-window sweeps.

## 4. Environments

Create a Railway **environment** per §9 of the build guide (`sandbox`,
`production`), each with its own database and its own `APP_ENV` /
`REGISTRY_MODE` values. The coloured strip at the top of the viewport always
tells the operator which one they are in.

## Notes

- `next start` binds to Railway's injected `PORT` automatically.
- `/api/health` returns 503 when a configured database is unreachable, so a
  broken deploy fails its healthcheck and is not promoted.
- Migrations are forward-only and hash-checked: editing an applied file makes
  the pre-deploy step fail loudly instead of silently diverging.
