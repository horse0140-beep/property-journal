-- HomeWise production schema audit (idempotent)
-- Run after 001–015. Aligns live Supabase with app code expectations.

-- ── helpers (idempotent) ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$ language sql security definer stable;

-- ── pricing_plans (admin billing UI) ───────────────────────────
create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null,
  name text not null,
  monthly_price numeric(10,2) not null default 0,
  yearly_price numeric(10,2) not null default 0,
  description text,
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pricing_plans_plan_key_uidx on public.pricing_plans (plan_key);

alter table public.pricing_plans drop constraint if exists pricing_plans_plan_key_check;
alter table public.pricing_plans add constraint pricing_plans_plan_key_check
  check (plan_key in ('free', 'premium', 'landlord', 'realtor'));

alter table public.pricing_plans enable row level security;

drop policy if exists "Anyone reads active pricing" on public.pricing_plans;
create policy "Anyone reads active pricing" on public.pricing_plans
  for select using (is_active = true or public.is_super_admin());

drop policy if exists "Admins manage pricing" on public.pricing_plans;
create policy "Admins manage pricing" on public.pricing_plans
  for all using (public.is_super_admin());

drop trigger if exists pricing_plans_updated_at on public.pricing_plans;
create trigger pricing_plans_updated_at
  before update on public.pricing_plans
  for each row execute function public.set_updated_at();

insert into public.pricing_plans (plan_key, name, monthly_price, yearly_price, description, features, sort_order)
values
  ('free', 'Free', 0, 0, 'Get started with one property',
   array['1 property', 'Basic health score', 'Manual entries'], 0),
  ('premium', 'Premium', 4.99, 39.99, 'For homeowners who want full protection',
   array['Unlimited properties', 'PDF reports', 'AI assistant', 'Cloud backup'], 1),
  ('landlord', 'Landlord Pro', 14.99, 149.99, 'Manage multiple rental units',
   array['Unlimited properties', 'Tenant sharing', 'Bulk reports', 'Priority support'], 2),
  ('realtor', 'Realtor Pro', 29.99, 299.99, 'Professional tools for agents',
   array['Buyer share links', 'Branded reports', 'Client management', 'Priority support'], 3)
on conflict (plan_key) do nothing;

-- ── notification_broadcasts (notification center) ─────────────
create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sent_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_broadcast_reads (
  user_id uuid references auth.users(id) on delete cascade not null,
  broadcast_id uuid references public.notification_broadcasts(id) on delete cascade not null,
  read_at timestamptz not null default now(),
  primary key (user_id, broadcast_id)
);

alter table public.notification_broadcasts enable row level security;
alter table public.user_broadcast_reads enable row level security;

drop policy if exists "Authenticated read active broadcasts" on public.notification_broadcasts;
create policy "Authenticated read active broadcasts" on public.notification_broadcasts
  for select using (auth.uid() is not null and is_active = true);

drop policy if exists "Admins manage broadcasts" on public.notification_broadcasts;
create policy "Admins manage broadcasts" on public.notification_broadcasts
  for all using (public.is_super_admin());

drop policy if exists "Users manage own broadcast reads" on public.user_broadcast_reads;
create policy "Users manage own broadcast reads" on public.user_broadcast_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── user_entitlements ───────────────────────────────────────────
create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entitlement text not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.user_entitlements
  add column if not exists granted_by uuid references auth.users(id) on delete set null;

alter table public.user_entitlements drop constraint if exists user_entitlements_entitlement_check;
alter table public.user_entitlements add constraint user_entitlements_entitlement_check
  check (entitlement in ('owner_access', 'premium', 'landlord', 'realtor'));

create unique index if not exists user_entitlements_user_entitlement_uidx
  on public.user_entitlements (user_id, entitlement);

alter table public.user_entitlements enable row level security;

drop policy if exists "Super admins manage entitlements" on public.user_entitlements;
create policy "Super admins manage entitlements" on public.user_entitlements
  for all using (public.is_super_admin());

drop policy if exists "Users read own entitlements" on public.user_entitlements;
create policy "Users read own entitlements" on public.user_entitlements
  for select using (auth.uid() = user_id);

-- ── promo_codes.discount_type ───────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'promo_codes' and column_name = 'type'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'promo_codes' and column_name = 'discount_type'
  ) then
    alter table public.promo_codes rename column type to discount_type;
  end if;
end $$;

alter table public.promo_codes
  add column if not exists discount_type text not null default 'percent';

alter table public.promo_codes drop constraint if exists promo_codes_discount_type_check;
alter table public.promo_codes add constraint promo_codes_discount_type_check
  check (discount_type in ('percent', 'fixed', 'free_trial', 'lifetime_access', 'owner_grant'));

-- ── documents.tags ──────────────────────────────────────────────
alter table public.documents add column if not exists tags text[] default '{}';
alter table public.receipts add column if not exists tags text[] default '{}';
alter table public.warranties add column if not exists tags text[] default '{}';

-- ── upsert unique constraints (ON CONFLICT targets) ─────────────
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_roles') then
    execute 'create unique index if not exists user_roles_user_id_uidx on public.user_roles (user_id)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'push_tokens') then
    execute 'create unique index if not exists push_tokens_user_token_uidx on public.push_tokens (user_id, token)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'property_scores') then
    execute 'create unique index if not exists property_scores_property_id_uidx on public.property_scores (property_id)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stripe_customers') then
    execute 'create unique index if not exists stripe_customers_user_id_uidx on public.stripe_customers (user_id)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'maintenance_forecasts') then
    execute 'create unique index if not exists maintenance_forecasts_user_property_uidx on public.maintenance_forecasts (user_id, property_id)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'promo_codes') then
    execute 'create unique index if not exists promo_codes_code_uidx on public.promo_codes (code)';
  end if;
end $$;

-- ── RLS: user-owned CRUD (explicit per operation) ─────────────
do $$
declare
  t text;
  tables text[] := array[
    'maintenance_items',
    'repairs',
    'appliances',
    'contractors',
    'documents',
    'receipts',
    'warranties',
    'paint_colors',
    'photos',
    'properties'
  ];
  op text;
  ops text[] := array['select', 'insert', 'update', 'delete'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);

    foreach op in array ops loop
      execute format('drop policy if exists %I on public.%I', t || '_' || op || '_own', t);
    end loop;

    execute format(
      'create policy "%I_select_own" on public.%I for select using (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy "%I_insert_own" on public.%I for insert with check (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy "%I_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy "%I_delete_own" on public.%I for delete using (auth.uid() = user_id)',
      t, t
    );

    execute format('drop policy if exists "Admins read all %I" on public.%I', t, t);
    execute format(
      'create policy "Admins read all %I" on public.%I for select using (public.is_super_admin())',
      t, t
    );
  end loop;
end $$;
