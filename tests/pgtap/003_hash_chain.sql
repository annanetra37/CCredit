-- pgTAP — hash chaining (S5-2).
-- Insert trigger computes hash = sha256(prev_hash ‖ device_id ‖ ts ‖ interval_wh ‖ source).

begin;
select plan(4);

insert into owner (id, legal_name, tax_id)
values ('00000000-0000-0000-0000-00000000aa02', 'Chain Owner', 'TAP-2');
insert into site (id, name, owner_id, is_sandbox)
values ('00000000-0000-0000-0000-00000000bb02', 'Chain Site',
        '00000000-0000-0000-0000-00000000aa02', true);
insert into device (id, site_id, type, serial)
values ('00000000-0000-0000-0000-00000000dd02',
        '00000000-0000-0000-0000-00000000bb02', 'METER', 'CHAIN-METER-1');

insert into reading_raw (device_id, site_id, ts, interval_wh, source, entered_by)
values ('00000000-0000-0000-0000-00000000dd02',
        '00000000-0000-0000-0000-00000000bb02',
        '2026-01-01T00:00:00Z', 1000, 'MANUAL',
        '00000000-0000-0000-0000-00000000aa02');

-- 1. first reading per device seeds with null prev_hash
select is(
  (select prev_hash from reading_raw
   where device_id = '00000000-0000-0000-0000-00000000dd02'
   order by ts limit 1),
  null,
  'first reading in a chain has null prev_hash'
);

-- 2. hash is populated by the trigger
select isnt(
  (select hash from reading_raw
   where device_id = '00000000-0000-0000-0000-00000000dd02'
   order by ts limit 1),
  null,
  'trigger computed a hash'
);

insert into reading_raw (device_id, site_id, ts, interval_wh, source, entered_by)
values ('00000000-0000-0000-0000-00000000dd02',
        '00000000-0000-0000-0000-00000000bb02',
        '2026-01-01T01:00:00Z', 1100, 'MANUAL',
        '00000000-0000-0000-0000-00000000aa02');

-- 3. second reading links to the first
select is(
  (select prev_hash from reading_raw
   where device_id = '00000000-0000-0000-0000-00000000dd02'
   order by ts desc limit 1),
  (select hash from reading_raw
   where device_id = '00000000-0000-0000-0000-00000000dd02'
   order by ts asc limit 1),
  'second reading prev_hash equals first reading hash'
);

-- 4. duplicate (device_id, ts, source) suppressed
select throws_ok(
  $$insert into reading_raw (device_id, site_id, ts, interval_wh, source, entered_by)
    values ('00000000-0000-0000-0000-00000000dd02',
            '00000000-0000-0000-0000-00000000bb02',
            '2026-01-01T01:00:00Z', 1100, 'MANUAL',
            '00000000-0000-0000-0000-00000000aa02')$$,
  '23505', null,
  'duplicate reading for (device, ts, source) is rejected'
);

select * from finish();
rollback;
