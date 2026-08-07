-- Migration 0002 — default UI language becomes English (product decision).
-- Armenian remains fully supported per-user; this only changes defaults.

alter table app_account alter column locale set default 'en';
alter table owner alter column preferred_language set default 'en';

update app_account set locale = 'en' where locale = 'hy';
