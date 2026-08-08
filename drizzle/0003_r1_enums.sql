-- Migration 0003 — Revision R1 (utility-data first), part 1: enum additions.
-- Kept separate from 0004 because Postgres refuses to USE a freshly added
-- enum value inside the same transaction that added it.

-- §4.1: the source hierarchy inverts. ENA billing becomes the record of
-- account; ranking itself lives in site.source_rank (0004), not in enum order.
alter type reading_source add value if not exists 'ENA_BILLING';
alter type reading_source add value if not exists 'OWNER_STATEMENT';

-- §4.3: ENA data lags 30–45 days; periods now wait for their source
-- explicitly instead of appearing broken.
alter type period_status add value if not exists 'AWAITING_SOURCE';

-- S6-3R: resolution outcomes for the utility-data world.
alter type resolution_outcome add value if not exists 'ENA_ESTIMATED_READING';
alter type resolution_outcome add value if not exists 'INVERTER_OFFLINE';
alter type resolution_outcome add value if not exists 'SITE_LOAD_CHANGE';
alter type resolution_outcome add value if not exists 'EXTRACTION_ERROR';
