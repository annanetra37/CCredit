# Attribute Origination Portal

Turns solar electricity readings into saleable certificates — I-RECs (via a
registry API) and VCUs (via an auditor-verified evidence package) — with an
audit trail that holds up years later.

Built from the *Portal Build Guide & Sprint Backlog*. Three things make this
different from a normal CRUD app:

1. **The data is evidence.** Readings are written once and never updated. An
   auditor can reconstruct the system as it stood on any past date.
2. **Double-issuance is a fraud event, not a bug.** One megawatt-hour produces
   exactly one certificate — enforced by a database constraint
   (`one_attribute_per_period`), never by application logic.
3. **The users are not technical.** The ELI5/InfoTip glossary system explains
   every strange word, in Armenian and English, at the point it appears.

## Stack

Node 22 · TypeScript strict · Next.js 15 (App Router) · PostgreSQL 16 +
TimescaleDB · Drizzle (SQL-first) · pg-boss · Tailwind 4 with CSS-variable
tokens · react-hook-form + Zod · next-intl (hy default, en) · Vitest ·
pgTAP · Playwright (planned).

Two documented deviations from the guide. First, the default UI language is
English (product decision); Armenian remains a complete, first-class locale —
every UI string, glossary entry and contract template exists in both, and
users switch with one click. Second, auth is a direct database-session
implementation rather than Auth.js — same design (revocable DB sessions,
role-based, expiring auditor accounts) in ~150 auditable lines; the session
table matches the Auth.js adapter shape so swapping in later touches one file.
See `lib/auth.ts`.

## Getting started

```bash
npm install
cp .env.example .env.local        # fill in DATABASE_URL etc.
npm run db:migrate                # applies drizzle/*.sql (forward-only)
npm run db:seed                   # glossary hy+en, demo accounts, AM emission factor
npm run db:seed-scenarios         # 5 sandbox sites incl. deliberately broken ones
npm run dev
```

Demo accounts (password `portal-demo`): `admin@portal.am`, `ops@portal.am`,
`mrv@portal.am`, `carbon@portal.am`, `commercial@portal.am`, `tech@portal.am`,
`owner@portal.am`, `vendor@portal.am`, `auditor@portal.am`.

Jobs (chain verification nightly, calibration/consent/issuance-window sweeps):

```bash
npm run jobs
```

Tests:

```bash
npm run typecheck
npm test                          # 153 unit tests: domain, gate, contrast, architecture
pg_prove -d $DATABASE_URL tests/pgtap/*.sql   # constraint proofs (needs pgtap)
```

## Repository layout (§2.1 of the build guide)

```
/app
  /(ops)        internal console: dashboard, sites, readings, reconciliation,
                attributes, issuance, audit, admin
  /(owner)      site owner portal (Armenian-first, larger type)
  /(vendor)     installer portal: fleet, commissions
  /(auditor)    read-only VVB console: asOf reconstruction, chain verification
  /glossary     public searchable glossary
  /design       every component in every state (Storybook substitute)
/lib
  /db           schema, migrations runner, seeds
  /domain       PURE business logic — no I/O imports (enforced by test)
    /ledger     attribute + site state machines
    /reconcile  three-way comparison
    /calc       emission reduction maths
    /integrity  hash-chain verification
  /adapters     ReadingSource interface; manual is the first implementation
  /integrations registry client (with the sandbox gate), e-sign, vault
  /glossary     ELI5 content, hy + en
  /actions      server actions (each mutation writes an audit_event)
/components     design system: InfoTip, StatusPill, DataCard, TraceLink,
                SourceBadge, SandboxBanner, EmptyState, StepFlow, BilingualField
/jobs           pg-boss workers
/drizzle        forward-only SQL migrations (the constraints live here)
/tests          vitest suites + pgTAP constraint tests
/docs           user guide (clear + ELI5)
```

## The guardrails and where they are enforced

| Rule | Enforcement |
|---|---|
| Raw readings append-only | `REVOKE UPDATE, DELETE ON reading_raw FROM app_user` (drizzle/0001) + pgTAP test |
| One MWh, one attribute | `UNIQUE (site_id, period_id)` + pgTAP double-allocation test (tests/pgtap/001) |
| Hash chain per device | Insert trigger (drizzle/0001) + nightly `jobs/verify-chains.ts` + on-demand from the auditor console |
| Meter beats inverter | `lib/domain/reconcile` adopts METER as record of account |
| Expired calibration blocks issuance | `hasValidCalibration` guard on the ALLOCATED transition, unit tested |
| Every figure traces to source | `carbon_calculation.input_reading_ids` + factor version FK; TraceLink UI |
| Point-in-time reconstruction | bitemporal `valid_from/valid_to` on mutable entities; auditor console `asOf` |
| Sandbox never reaches a registry | `assertNoSandboxAttributes` throws inside every registry client before any I/O |

## Deployment

Railway config-as-code is included: `railway.json` (web, with pre-deploy
migrations and `/api/health` healthcheck) and `railway.jobs.json` (pg-boss
worker). Step-by-step: `docs/DEPLOY_RAILWAY.md`.

## Documentation

- `docs/USER_GUIDE.md` — how to use the portal, with a plain-English/ELI5
  track for every role.
- The in-app glossary (`/glossary`) is the living vocabulary reference,
  editable at `/admin/glossary` without a deploy.
