-- Migration 0000 — initial schema.
-- Forward-only. Never edit an applied migration.
-- Run with the admin connection (DATABASE_ADMIN_URL): the REVOKE and trigger
-- DDL require ownership.

create extension if not exists pgcrypto;

-- TimescaleDB is preferred in real environments but tolerated as absent
-- (Railway managed Postgres, plain CI containers): the extension creation is
-- attempted, and the hypertable call further down only runs if it succeeded.
-- Readings then live in a plain table — fine for demo volumes; switch to the
-- timescale/timescaledb image before real meter data arrives.
do $$
begin
  begin
    create extension if not exists timescaledb cascade;
  exception when others then
    raise notice 'timescaledb extension not available on this server — continuing without hypertables';
  end;
end $$;

-- The application role. The portal connects as app_user; migrations run as
-- the superuser. This split is what makes "REVOKE UPDATE, DELETE" meaningful.
do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user login password 'app_user_dev_only';
  end if;
end $$;

-- ---------------------------------------------------------------- enums
create type user_role as enum ('admin','ops','mrv_analyst','carbon_manager','commercial','field_tech','owner','vendor','auditor');
create type reading_source as enum ('MANUAL','METER','INVERTER_API');
create type site_status as enum ('LEAD','QUALIFYING','CONTRACTED','METERED','COMMISSIONED','ASSESSED','PRODUCING','SUSPENDED','TERMINATED');
create type attr_track as enum ('UNASSIGNED','IREC','CARBON');
create type attr_status as enum ('MEASURED','RECONCILED','DISPUTED','ELIGIBLE','ALLOCATED','ISSUED','TRANSFERRED','REDEEMED','VOID');
create type device_type as enum ('METER','GATEWAY','INVERTER');
create type period_status as enum ('OPEN','RECONCILED','DISPUTED','VOID');
create type track_outcome as enum ('CARBON_ELIGIBLE','IREC_ONLY','PENDING_REVIEW');
create type registration_status as enum ('DRAFT','SUBMITTED','LOCKED','APPROVED','REJECTED');
create type issue_request_status as enum ('DRAFT','CHECKS_PASSED','SUBMITTED','ISSUED','REJECTED');
create type resolution_outcome as enum ('INSTRUMENT_FAULT','COMMS_GAP','CURTAILMENT','METER_REPLACEMENT','BILLING_LAG','DATA_ERROR','ACCEPTED_WITH_VARIANCE');
create type document_class as enum ('CONTRACT','CALIBRATION_CERTIFICATE','SITE_PHOTO','NAMEPLATE_PHOTO','METER_SEAL_PHOTO','UTILITY_BILL','REGISTRY_EVIDENCE','OWNER_ID','OTHER');

-- ---------------------------------------------------------------- auth
create table app_account (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  role user_role not null,
  locale text not null default 'hy',
  expires_at timestamptz,
  disabled_at timestamptz,
  owner_id uuid,
  vendor_id uuid,
  created_at timestamptz not null default now()
);

create table session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_account(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text,
  user_agent text
);

-- ---------------------------------------------------------------- master data
create table owner (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  tax_id text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  bank_details_encrypted text,
  preferred_language text not null default 'hy',
  created_at timestamptz not null default now()
);

create table vendor (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  agreement_version text,
  commission_rate_pct numeric(5,2),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table site (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references owner(id),
  vendor_id uuid references vendor(id),
  status site_status not null default 'LEAD',
  capacity_kw numeric(10,2),
  commissioning_date timestamptz,
  technology text not null default 'SOLAR_PV',
  inverter_make text,
  inverter_model text,
  module_make text,
  module_model text,
  tilt_deg numeric(4,1),
  orientation_deg numeric(4,1),
  lat numeric(9,6),
  lon numeric(9,6),
  address text,
  is_sandbox boolean not null default false,
  reconcile_tolerance_pct numeric(5,2),
  tolerance_override_reason text,
  cohort text,
  created_at timestamptz not null default now(),
  constraint tolerance_override_needs_reason
    check (reconcile_tolerance_pct is null or tolerance_override_reason is not null)
);

create table site_transition (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  from_status site_status not null,
  to_status site_status not null,
  actor_id uuid not null,
  note text,
  ts timestamptz not null default now()
);

-- ---------------------------------------------------------------- devices
create table device (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  type device_type not null,
  serial text not null,
  make text,
  model text,
  accuracy_class text,
  ct_ratio text,
  seal_number text,
  installed_at timestamptz,
  decommissioned_at timestamptz,
  replaced_by_device_id uuid,
  changeover_register_wh numeric(18,3),
  created_at timestamptz not null default now(),
  constraint device_serial_unique unique (type, serial)
);

create table calibration (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references device(id),
  certificate_document_id uuid,
  issue_date timestamptz not null,
  version int not null default 1,
  valid_from timestamptz not null,
  valid_to timestamptz,
  superseded_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- contracts
create table contract_template (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version int not null,
  locale text not null,
  body text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  constraint template_code_version_locale unique (code, version, locale)
);

create table contract (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  owner_id uuid not null references owner(id),
  template_code text not null,
  template_version int not null,
  attribute_scope text not null default 'ALL',
  retained_share_pct numeric(5,2) not null default 0,
  payment_basis text not null default 'FIXED_RATE',
  rate_per_mwh_amd numeric(12,2),
  revenue_share_pct numeric(5,2),
  term_months int not null,
  notice_period_days int not null default 30,
  signed_at timestamptz,
  signatory_name text,
  signatory_ip text,
  signed_pdf_document_id uuid,
  amends_contract_id uuid,
  version int not null default 1,
  valid_from timestamptz not null,
  valid_to timestamptz,
  superseded_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- vault
create table document (
  id uuid primary key default gen_random_uuid(),
  class document_class not null,
  site_id uuid references site(id),
  owner_id uuid references owner(id),
  device_id uuid references device(id),
  language text,
  filename text not null,
  content_type text not null,
  storage_key text not null,
  sha256 text not null,
  size_bytes int not null,
  version int not null default 1,
  valid_from timestamptz not null,
  valid_to timestamptz,
  superseded_by uuid,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- periods & readings
create table period (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  starts_on timestamptz not null,
  ends_on timestamptz not null,
  status period_status not null default 'OPEN',
  sources_present jsonb,
  supervisor_approval_by uuid,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint period_site_window unique (site_id, starts_on, ends_on)
);

-- §6.1 — append-only, hash-chained
create table reading_raw (
  id bigserial,
  device_id uuid not null,
  site_id uuid not null,
  ts timestamptz not null,
  register_wh numeric(18,3),
  interval_wh numeric(18,3) not null,
  source reading_source not null,
  entered_by uuid,
  prev_hash bytea,
  hash bytea not null,
  created_at timestamptz not null default now(),
  constraint manual_needs_operator
    check (source <> 'MANUAL' or entered_by is not null)
);

-- Hypertable where TimescaleDB is present (production, sandbox, staging).
do $$
begin
  if exists (select from pg_extension where extname = 'timescaledb') then
    perform create_hypertable('reading_raw','ts');
  end if;
end $$;

create unique index reading_dedupe on reading_raw (device_id, ts, source);
create index reading_site_ts on reading_raw (site_id, ts);

create table reading_adjustment (
  id uuid primary key default gen_random_uuid(),
  reading_id numeric(20,0) not null,
  effective_interval_wh numeric(18,3) not null,
  reason_code text not null,
  justification text not null,
  operator_id uuid not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- reconciliation
create table reconciliation (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references period(id),
  meter_mwh numeric(14,4),
  inverter_mwh numeric(14,4),
  utility_mwh numeric(14,4),
  auxiliary_mwh numeric(14,4),
  adopted_mwh numeric(14,4),
  adopted_source reading_source,
  tolerance_pct numeric(5,2) not null,
  max_variance_pct numeric(8,4),
  outcome period_status not null,
  detail jsonb,
  run_by uuid,
  created_at timestamptz not null default now()
);

create table reconciliation_resolution (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references reconciliation(id),
  outcome resolution_outcome not null,
  note text not null,
  resolved_by uuid not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- attribute ledger (§6.2)
create table attribute (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  period_id uuid not null references period(id),
  mwh numeric(14,4) not null check (mwh >= 0),
  track attr_track not null default 'UNASSIGNED',
  status attr_status not null default 'MEASURED',
  serial_no text,
  issued_at timestamptz,
  redeemed_at timestamptz,
  is_sandbox boolean not null default false,
  created_at timestamptz not null default now(),

  -- THE constraint. One MWh-period, one row, one destiny.
  constraint one_attribute_per_period unique (site_id, period_id),

  constraint issued_needs_track
    check (status not in ('ISSUED','TRANSFERRED','REDEEMED') or track <> 'UNASSIGNED'),
  constraint issued_needs_serial
    check (status not in ('ISSUED','TRANSFERRED','REDEEMED') or serial_no is not null)
);

create table attribute_transition (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references attribute(id),
  from_status attr_status not null,
  to_status attr_status not null,
  actor_id uuid not null,
  note text,
  ts timestamptz not null default now()
);

create table track_assignment (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  outcome track_outcome not null,
  assessor_name text not null,
  assessed_on timestamptz not null,
  rationale text not null,
  cohort text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- carbon
create table emission_factor (
  id uuid primary key default gen_random_uuid(),
  grid_region text not null default 'AM',
  om_tco2_per_mwh numeric(8,4),
  bm_tco2_per_mwh numeric(8,4),
  cm_tco2_per_mwh numeric(8,4) not null,
  om_weight numeric(4,2),
  bm_weight numeric(4,2),
  source_reference text not null,
  source_document_id uuid,
  version int not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  superseded_by uuid,
  created_at timestamptz not null default now()
);

create table carbon_calculation (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references attribute(id),
  gross_mwh numeric(14,4) not null,
  auxiliary_mwh numeric(14,4) not null default 0,
  net_mwh numeric(14,4) not null,
  emission_factor_id uuid not null references emission_factor(id),
  tco2e numeric(14,4) not null,
  input_reading_ids jsonb not null,
  version int not null default 1,
  superseded_by uuid,
  calculated_by uuid not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- registry
create table registry_registration (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  registry text not null default 'I-REC',
  status registration_status not null default 'DRAFT',
  registry_device_code text,
  rejection_reason text,
  payload jsonb,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table issue_request (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id),
  status issue_request_status not null default 'DRAFT',
  attribute_ids jsonb not null,
  total_mwh numeric(14,4) not null,
  checklist jsonb,
  registry_reference text,
  submitted_by uuid,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table certificate_event (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references attribute(id),
  event text not null,
  counterparty text,
  beneficiary text,
  ts timestamptz not null default now(),
  detail jsonb
);

-- ---------------------------------------------------------------- commercial
create table buyer (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  contact_email text,
  created_at timestamptz not null default now()
);

create table offtake_contract (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references buyer(id),
  product text not null,
  price_per_unit_eur numeric(12,2),
  volume_units numeric(14,4),
  delivery_schedule jsonb,
  version int not null default 1,
  valid_from timestamptz not null,
  valid_to timestamptz,
  superseded_by uuid,
  created_at timestamptz not null default now()
);

create table payout (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owner(id),
  period_label text not null,
  mwh numeric(14,4) not null,
  gross_amd numeric(14,2) not null,
  deductions_amd numeric(14,2) not null default 0,
  net_amd numeric(14,2) not null,
  statement_document_id uuid,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table vendor_commission (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendor(id),
  site_id uuid not null references site(id),
  period_label text not null,
  amount_amd numeric(14,2) not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- glossary (§5.1)
create table glossary_entry (
  key text not null,
  locale text not null,
  term text not null,
  short text not null,
  eli5 text not null,
  why_it_matters text not null,
  example text,
  learn_more_url text,
  group_key text not null,
  related_keys jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

-- ---------------------------------------------------------------- audit & integrity
create table audit_event (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  ts timestamptz not null default now()
);
create index audit_actor_ts on audit_event (actor_id, ts);
create index audit_entity on audit_event (entity_type, entity_id);

create table chain_verification_run (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  devices_checked int not null default 0,
  readings_checked int not null default 0,
  breaks jsonb,
  triggered_by text not null default 'schedule',
  ok boolean
);

create table alert (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'info',
  site_id uuid,
  device_id uuid,
  message text not null,
  detail jsonb,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- grants
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
