-- HomeWise Premium Features tables

-- ── property_shares ─────────────────────────────────────────
create table if not exists public.property_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id text not null,
  property_label text not null,
  share_token text not null unique,
  label text not null default 'Property Share',
  expires_at timestamptz,
  is_active boolean not null default true,
  views_count integer not null default 0,
  include_personal_info boolean not null default false,
  snapshot_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── contractor_portal_access ────────────────────────────────
create table if not exists public.contractor_portal_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id text not null,
  property_label text not null,
  contractor_name text not null,
  contractor_email text not null,
  contractor_phone text,
  trade text not null default 'General',
  access_code text not null unique,
  permissions text[] not null default array['view_maintenance', 'view_repairs'],
  notes text,
  is_active boolean not null default true,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── maintenance_forecasts ───────────────────────────────────
create table if not exists public.maintenance_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id text not null,
  summary text not null,
  items jsonb not null default '[]',
  annual_budget text not null default '$0',
  generated_at timestamptz not null default now(),
  unique (user_id, property_id)
);

-- ── stripe_customers ────────────────────────────────────────
create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_key text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── triggers ────────────────────────────────────────────────
drop trigger if exists property_shares_updated_at on public.property_shares;
create trigger property_shares_updated_at
  before update on public.property_shares
  for each row execute function public.set_updated_at();

drop trigger if exists contractor_portal_access_updated_at on public.contractor_portal_access;
create trigger contractor_portal_access_updated_at
  before update on public.contractor_portal_access
  for each row execute function public.set_updated_at();

drop trigger if exists stripe_customers_updated_at on public.stripe_customers;
create trigger stripe_customers_updated_at
  before update on public.stripe_customers
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
alter table public.property_shares enable row level security;
alter table public.contractor_portal_access enable row level security;
alter table public.maintenance_forecasts enable row level security;
alter table public.stripe_customers enable row level security;

create policy "Users manage own property shares" on public.property_shares
  for all using (auth.uid() = user_id);

create policy "Public read active shares by token" on public.property_shares
  for select using (is_active = true);

create policy "Users manage own contractor access" on public.contractor_portal_access
  for all using (auth.uid() = user_id);

create policy "Users manage own forecasts" on public.maintenance_forecasts
  for all using (auth.uid() = user_id);

create policy "Users read own stripe record" on public.stripe_customers
  for select using (auth.uid() = user_id);

create policy "Users upsert own stripe record" on public.stripe_customers
  for insert with check (auth.uid() = user_id);

create policy "Users update own stripe record" on public.stripe_customers
  for update using (auth.uid() = user_id);

create policy "Admins manage stripe records" on public.stripe_customers
  for all using (public.is_super_admin());
