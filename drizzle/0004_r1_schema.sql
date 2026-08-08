-- Migration 0004 — Revision R1 (utility-data first), part 2: schema.

-- §4.2: every reading must declare WHAT it measures, because the sources no
-- longer measure the same thing. Inverter = generation; ENA = export/import.
create type measured_quantity as enum ('GENERATION','EXPORT','IMPORT','CONSUMPTION');

alter table reading_raw add column quantity measured_quantity not null default 'EXPORT';

-- What the Issuer actually certifies for this site. One column, determines
-- revenue — confirm generation-vs-export with the Issuer (R1 §2.3) before
-- trusting calculations built on it.
alter table site add column certifies measured_quantity not null default 'EXPORT';

-- §4.1: rank is configurable per site so a site where we DID install a meter
-- can promote METER above ENA_BILLING.
alter table site add column source_rank jsonb not null
  default '{"ENA_BILLING":1,"METER":2,"OWNER_STATEMENT":3,"INVERTER_API":4,"MANUAL":5}';

-- S3B-4: ENA account matching.
alter table site add column ena_account_number text;
alter table site add column connection_point_id text;

-- S3B-2: acquisition mode per site (API | BULK_EXPORT | PER_SITE_REQUEST | OWNER_UPLOAD).
alter table site add column acquisition_mode text not null default 'OWNER_UPLOAD';

-- S3B-1: explicit, separately acknowledged data-release consent. A site
-- cannot enter the acquisition flow without one, and allocation requires the
-- consent to cover the whole period (hasValidEvidenceBasis).
create table data_release_consent (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  scope text not null default 'ENA_BILLING_DATA',
  signatory_name text not null,
  signed_at timestamptz not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  document_id uuid,
  created_at timestamptz not null default now()
);

-- S3B-3: bill parsing with mandatory human confirmation. Extraction is never
-- auto-accepted; every parsed record waits here until an analyst confirms.
create table bill_extraction (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references site(id),
  ena_account_number text,
  document_id uuid,
  filename text,
  period_start timestamptz,
  period_end timestamptz,
  export_kwh numeric(18,3),
  import_kwh numeric(18,3),
  tariff text,
  confidence numeric(4,3) not null default 0,
  status text not null default 'PENDING',   -- PENDING | CONFIRMED | CORRECTED | REJECTED
  original_values jsonb,
  correction_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reading_ids jsonb,
  created_at timestamptz not null default now()
);

-- S6-1R: reconciliation stores the quantity-aware figures and the soft-rule
-- FLAGGED outcome (reconciled but surfaced for review).
alter table reconciliation add column generation_mwh numeric(14,4);
alter table reconciliation add column export_mwh numeric(14,4);
alter table reconciliation add column self_consumed_mwh numeric(14,4);
alter table reconciliation add column flagged boolean not null default false;
alter table reconciliation add column flag_reasons jsonb;

grant select, insert, update, delete on data_release_consent, bill_extraction to app_user;
