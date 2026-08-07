-- Migration 0001 — integrity mechanisms (Sprint 5).
-- The rules with teeth: append-only enforcement and the per-device hash chain.

-- ---------------------------------------------------------------- append-only
-- Rule: raw readings are append-only. The application role literally lacks
-- permission to change history. Corrections go through reading_adjustment.
revoke update, delete on reading_raw from app_user;

-- Adjustments and audit events are also never rewritten.
revoke update, delete on reading_adjustment from app_user;
revoke update, delete on audit_event from app_user;

-- ---------------------------------------------------------------- hash chain
-- Each reading is cryptographically linked to the previous one on the same
-- device: hash = sha256(prev_hash ‖ device_id ‖ ts ‖ interval_wh ‖ source).
-- The first reading per device seeds with a null prev_hash. Any retrospective
-- edit (even by a superuser) breaks the chain, and the nightly verification
-- job walks every chain and alerts on a break.
create or replace function reading_raw_hash_chain() returns trigger as $$
declare
  last_hash bytea;
begin
  select r.hash into last_hash
  from reading_raw r
  where r.device_id = new.device_id
  order by r.ts desc
  limit 1;

  new.prev_hash := last_hash;
  new.hash := digest(
    coalesce(last_hash, ''::bytea)
      || new.device_id::text::bytea
      || extract(epoch from new.ts)::text::bytea
      || new.interval_wh::text::bytea
      || new.source::text::bytea,
    'sha256'
  );
  return new;
end;
$$ language plpgsql;

create trigger reading_raw_hash_chain_trg
  before insert on reading_raw
  for each row execute function reading_raw_hash_chain();
