-- pgTAP — the double-counting firewall (S7-1).
-- "Before any issuance code exists, write the pgTAP test that attempts a
--  double allocation and asserts rejection. Everything else in this system is
--  convenience; that constraint is what keeps the business out of a fraud
--  investigation."
--
-- Run: pg_prove -d $DATABASE_URL tests/pgtap/*.sql   (requires pgtap extension)

begin;
select plan(6);

-- fixture: one owner, one site, one period
insert into owner (id, legal_name, tax_id)
values ('00000000-0000-0000-0000-00000000aa01', 'pgTAP Owner', 'TAP-1');

insert into site (id, name, owner_id, is_sandbox)
values ('00000000-0000-0000-0000-00000000bb01', 'pgTAP Site',
        '00000000-0000-0000-0000-00000000aa01', true);

insert into period (id, site_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000cc01',
        '00000000-0000-0000-0000-00000000bb01',
        '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z');

-- 1. first attribute for the period inserts cleanly
select lives_ok(
  $$insert into attribute (site_id, period_id, mwh, is_sandbox)
    values ('00000000-0000-0000-0000-00000000bb01',
            '00000000-0000-0000-0000-00000000cc01', 1.2345, true)$$,
  'first attribute for a (site, period) inserts'
);

-- 2. THE test: a second attribute for the same (site, period) is rejected
select throws_ok(
  $$insert into attribute (site_id, period_id, mwh, is_sandbox)
    values ('00000000-0000-0000-0000-00000000bb01',
            '00000000-0000-0000-0000-00000000cc01', 9.9, true)$$,
  '23505', null,
  'double allocation for the same (site, period) is rejected by the database'
);

-- 3. negative MWh is rejected
select throws_ok(
  $$insert into attribute (site_id, period_id, mwh)
    values ('00000000-0000-0000-0000-00000000bb01',
            gen_random_uuid(), -1)$$,
  '23503', null,  -- fails FK first with a random period; the point is it cannot land
  'nonsense attribute rows do not insert'
);

-- 4. ISSUED without a track is rejected
select throws_ok(
  $$update attribute
      set status = 'ISSUED', serial_no = 'SER-1'
    where period_id = '00000000-0000-0000-0000-00000000cc01'$$,
  '23514', null,
  'ISSUED with track UNASSIGNED violates issued_needs_track'
);

-- 5. ISSUED without a serial is rejected
select throws_ok(
  $$update attribute
      set status = 'ISSUED', track = 'IREC'
    where period_id = '00000000-0000-0000-0000-00000000cc01'$$,
  '23514', null,
  'ISSUED without serial_no violates issued_needs_serial'
);

-- 6. a fully-formed issuance passes
select lives_ok(
  $$update attribute
      set status = 'ISSUED', track = 'IREC', serial_no = 'SER-1',
          issued_at = now()
    where period_id = '00000000-0000-0000-0000-00000000cc01'$$,
  'a complete issuance (track + serial) is accepted'
);

select * from finish();
rollback;
