-- pgTAP — append-only enforcement (S5-1).
-- The application role literally lacks permission to alter history.

begin;
select plan(3);

select ok(
  not has_table_privilege('app_user', 'reading_raw', 'UPDATE'),
  'app_user cannot UPDATE reading_raw'
);

select ok(
  not has_table_privilege('app_user', 'reading_raw', 'DELETE'),
  'app_user cannot DELETE from reading_raw'
);

select ok(
  has_table_privilege('app_user', 'reading_raw', 'INSERT'),
  'app_user can still INSERT readings'
);

select * from finish();
rollback;
