-- Appliances: canonical columns + backfill from legacy names.

alter table public.appliances
  add column if not exists brand text default '',
  add column if not exists model text default '',
  add column if not exists serial_number text default '',
  add column if not exists purchase_date text default '',
  add column if not exists warranty_expiration text default '',
  add column if not exists photo_url text,
  add column if not exists notes text default '',
  add column if not exists is_active boolean not null default true;

-- Legacy column names (003_core_data.sql) — add if an older partial table exists.
alter table public.appliances
  add column if not exists serial text default '',
  add column if not exists install_date text default '',
  add column if not exists warranty_expires text default '',
  add column if not exists purchase_price text default '',
  add column if not exists expected_life_years integer default 10,
  add column if not exists last_service text default '',
  add column if not exists next_service text default '',
  add column if not exists condition text default 'Good',
  add column if not exists manual_url text,
  add column if not exists receipt_url text;

update public.appliances
set serial_number = serial
where coalesce(serial_number, '') = '' and coalesce(serial, '') <> '';

update public.appliances
set purchase_date = install_date
where coalesce(purchase_date, '') = '' and coalesce(install_date, '') <> '';

update public.appliances
set warranty_expiration = warranty_expires
where coalesce(warranty_expiration, '') = '' and coalesce(warranty_expires, '') <> '';

update public.appliances
set is_active = true
where is_active is null;
