# Discovery spike — resolve BEFORE committing to Revision R1

Revision R1 (utility-data first) rests on two unconfirmed assumptions. Both
are answerable in under two weeks, largely by email, and both are **founder
tasks, not engineering**. Engineering proceeds with the unaffected sprints in
parallel; do not commit this plan to a budget or delivery date until these
are answered.

## Question A — Does Armenia have an accredited I-REC Issuer?

- Check the accredited issuer list at irecstandard.org for Armenia.
- If absent, contact the I-TRACK Foundation: is accreditation in progress or
  possible?
- **If the answer is no: stop.** Neither track is viable near-term and the
  build should not continue past the foundations.

## Question B — Will ENA provide usable data at scale?

Run a three-site pilot: obtain owner consent, request the data, record
exactly what arrives and how long it takes.

| Establish | Why it matters |
|---|---|
| Granularity (monthly vs interval) | Monthly suffices for I-REC; carbon may need finer |
| Format (API / CSV / PDF / portal) | Integration vs OCR pipeline |
| Latency (days after period end) | Sets when periods can close |
| Access route (bulk / per-site / owner-delegated) | Scales to 200 sites or dies at 20 |
| Required consent wording | Feeds the Sprint 2 contract template |
| Does the bill separate export from import? | Without export there is nothing to certify |
| Per-request fee | Above ~$15/site/year, our own meter is cheaper over 5 years |

## Question C — Ask the Issuer what data they accept

One email; it is the specification for the entire data layer:

1. Do you accept utility billing data as the generation record for
   distributed systems, or require dedicated metering?
2. **Do you certify generation or export?** (Factor-of-two revenue impact on
   self-consuming sites — drives `site.certifies`.)
3. What supporting evidence must accompany an issue request?
4. What is the retrospective issuance window?

## Decision tree

- Issuer exists + ENA data workable → **build R1 as specified** (this codebase).
- Issuer exists + ENA unworkable → revert to the hardware plan: per-site
  `source_rank` promotes METER, calibration lifecycle returns. The
  `ReadingSource` interface exists precisely so this is configuration plus
  one adapter, not a rewrite.
- Issuer requires dedicated metering → hardware plan regardless of ENA.
- No Issuer in Armenia → **stop and reassess the venture.**

## Contingency quick reference (R1 §9)

| Failure mode | Response |
|---|---|
| Per-site requests only | Lean on Mode D (owner uploads); ops headcount, not engineering |
| Annual data only | Workable for I-REC, poor cash flow; own metering on carbon-track sites |
| Bills don't separate export | Serious — revert to own metering |
| Per-request fee uneconomic | Own meter cheaper above ~$15/site/year |
