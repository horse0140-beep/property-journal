-- Optional user entitlements table for owner_access and plan grants
-- Run after 001_admin_tables.sql

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entitlement text not null
    check (entitlement in ('owner_access', 'premium', 'landlord', 'realtor')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, entitlement)
);

alter table public.user_entitlements enable row level security;

drop policy if exists "Super admins manage entitlements" on public.user_entitlements;
create policy "Super admins manage entitlements" on public.user_entitlements
  for all using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'super_admin'
    )
  );
