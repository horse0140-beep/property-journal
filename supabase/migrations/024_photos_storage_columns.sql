-- Add storage + display URL columns used by photoService (safe to re-run).

alter table public.photos add column if not exists photo_url text default '';
alter table public.photos add column if not exists file_url text default '';
alter table public.photos add column if not exists uri text default '';
alter table public.photos add column if not exists storage_path text default '';
alter table public.photos add column if not exists storage_bucket text default '';
