-- Align live Supabase schema with app: properties.is_selected + property_scores.user_id

-- ── properties.is_selected ──────────────────────────────────
alter table public.properties
  add column if not exists is_selected boolean not null default false;

-- ── property_scores (create or patch) ───────────────────────
create table if not exists public.property_scores (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade not null unique,
  overall integer not null default 0,
  maintenance integer not null default 0,
  appliances integer not null default 0,
  repairs integer not null default 0,
  warranty integer not null default 0,
  inspections integer not null default 0,
  label text not null default 'Fair',
  updated_at timestamptz not null default now()
);

alter table public.property_scores
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Backfill user_id from owning property
update public.property_scores ps
set user_id = p.user_id
from public.properties p
where ps.property_id = p.id
  and ps.user_id is null;

-- Remove orphan score rows that cannot be linked to a property owner
delete from public.property_scores
where user_id is null;

alter table public.property_scores
  alter column user_id set not null;

-- Ensure score columns exist on older partial tables
alter table public.property_scores
  add column if not exists overall integer not null default 0,
  add column if not exists maintenance integer not null default 0,
  add column if not exists appliances integer not null default 0,
  add column if not exists repairs integer not null default 0,
  add column if not exists warranty integer not null default 0,
  add column if not exists inspections integer not null default 0,
  add column if not exists label text not null default 'Fair',
  add column if not exists updated_at timestamptz not null default now();

-- ── RLS for property_scores ─────────────────────────────────
alter table public.property_scores enable row level security;

drop policy if exists "Users manage own property_scores" on public.property_scores;
create policy "Users manage own property_scores" on public.property_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Admins read all property_scores" on public.property_scores;
create policy "Admins read all property_scores" on public.property_scores
  for select using (public.is_super_admin());
