# /lib/domain — pure business logic

**Rule:** this directory has no imports from `/lib/db` or `/lib/integrations`.
Business logic takes data in and returns data out. This is what makes the
ledger testable without a database and reviewable without tracing I/O.

Enforced by `tests/architecture.test.ts`, which greps every file here for
forbidden imports and fails the build on a violation.

- `ledger/` — attribute and site state machines, allocation guards
- `reconcile/` — the three-way comparison engine
- `calc/` — emission reduction maths
- `integrity/` — hash-chain verification logic
- `calibration.ts` — calibration coverage guard
