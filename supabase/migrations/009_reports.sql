-- Home History Report metadata
-- Run after 003_core_data.sql

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  property_address text not null,
  title text not null,
  file_url text,
  health_score integer not null default 0,
  maintenance_count integer not null default 0,
  repair_count integer not null default 0,
  appliance_count integer not null default 0,
  document_count integer not null default 0,
  photo_count integer not null default 0,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists reports_user_property_idx on public.reports (user_id, property_id);

alter table public.reports enable row level security;

drop policy if exists "Users manage own reports" on public.reports;
create policy "Users manage own reports" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Admins read all reports" on public.reports;
create policy "Admins read all reports" on public.reports
  for select using (public.is_super_admin());
