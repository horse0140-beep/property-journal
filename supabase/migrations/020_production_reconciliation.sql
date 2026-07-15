-- ═══════════════════════════════════════════════════════════════════════════
-- HomeWise 020 — Complete Production Schema Reconciliation (IDEMPOTENT)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this ONE migration on any production Supabase project (000–019 or none).
-- Safe to re-run. No data loss. Aligns live DB with application code.
--
-- Fixes reported production errors:
--   • maintenance_items / repairs / appliances / contractors INSERT blocked (RLS)
--   • documents.upload_date column missing
--   • promo_codes.discount_type column missing
--   • pricing_plans table missing
--   • notification_broadcasts policies
--   • Founder protection (horse0140@gmail.com, hdmccoy180@gmail.com)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Helpers ──────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Ensure legacy tables have created_at/updated_at before any UPDATE touches them
create or replace function public.ensure_table_timestamps(p_table text)
returns void
language plpgsql as $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table
  ) then
    return;
  end if;

  execute format(
    'alter table public.%I add column if not exists created_at timestamptz default now()',
    p_table
  );
  execute format(
    'alter table public.%I add column if not exists updated_at timestamptz default now()',
    p_table
  );
  execute format(
    'update public.%I set created_at = now() where created_at is null',
    p_table
  );
  execute format(
    'update public.%I set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null',
    p_table
  );
end;
$$;

create or replace function public.founder_emails()
returns text[]
language sql immutable as $$
  select array['horse0140@gmail.com', 'hdmccoy180@gmail.com']::text[];
$$;

create or replace function public.is_founder_email(p_email text)
returns boolean
language sql immutable as $$
  select lower(trim(coalesce(p_email, ''))) = any (
    select lower(e) from unnest(public.founder_emails()) as e
  );
$$;

create or replace function public.is_founder_user(p_user_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and public.is_founder_email(u.email::text)
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  )
  or exists (
    select 1 from auth.users u
    where u.id = auth.uid() and public.is_founder_email(u.email::text)
  );
$$;

-- ── 2. Core tables (create if missing) ──────────────────────────────────────
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nickname text,
  address text not null default '',
  city text default '',
  state text default '',
  zip text default '',
  type text default 'primary',
  year_built text default '',
  square_feet text default '',
  bedrooms text default '',
  bathrooms text default '',
  purchase_price text default '',
  estimated_value text default '',
  purchase_date text default '',
  photo_url text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  category text default '',
  last_completed text default '',
  next_due text default '',
  status text default 'Upcoming',
  notes text default '',
  recurring boolean not null default false,
  interval_days integer,
  priority text default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  date text default '',
  cost text default '',
  contractor text default '',
  category text default '',
  notes text default '',
  photo_urls text[] default '{}',
  receipt_url text,
  warranty_expires text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appliances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  name text not null,
  category text default '',
  brand text default '',
  model text default '',
  serial text default '',
  install_date text default '',
  purchase_price text default '',
  expected_life_years integer default 10,
  warranty_expires text default '',
  last_service text default '',
  next_service text default '',
  condition text default 'Good',
  notes text default '',
  photo_url text,
  manual_url text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  category text default 'other',
  file_url text,
  file_type text default 'pdf',
  file_size text default '',
  upload_date text default '',
  expires_date text,
  notes text default '',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  file_url text,
  file_type text default 'pdf',
  file_size text default '',
  upload_date text default '',
  notes text default '',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  file_url text,
  file_type text default 'pdf',
  file_size text default '',
  upload_date text default '',
  expires_date text,
  notes text default '',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  file_url text not null default '',
  caption text default '',
  date text default '',
  category text default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete set null,
  name text not null,
  trade text default '',
  phone text default '',
  email text default '',
  website text default '',
  rating integer default 5,
  notes text default '',
  last_used text default '',
  license_number text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paint_colors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  room text not null,
  brand text default '',
  color_name text default '',
  color_code text default '',
  finish text default '',
  hex text default '',
  purchase_date text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade not null,
  overall integer not null default 0,
  maintenance integer not null default 0,
  appliances integer not null default 0,
  repairs integer not null default 0,
  warranty integer not null default 0,
  inspections integer not null default 0,
  label text not null default 'Fair',
  updated_at timestamptz not null default now()
);

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

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  discount_type text not null default 'percent',
  discount_value numeric(10,2) not null default 0,
  plan_scope text not null default 'all',
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entitlement text not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  property_address text not null default '',
  title text not null default '',
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

-- ── 3. Column reconciliation (add missing, never drop) ──────────────────────
-- Admin tables: legacy deployments may lack timestamp columns used below
do $$
declare t text;
begin
  foreach t in array array[
    'user_roles', 'profiles', 'promo_codes', 'pricing_plans',
    'subscriptions', 'support_tickets', 'user_entitlements'
  ] loop
    perform public.ensure_table_timestamps(t);
  end loop;
end $$;

alter table public.user_roles
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists role text default 'user';

alter table public.properties
  add column if not exists nickname text,
  add column if not exists photo_url text,
  add column if not exists is_selected boolean not null default false,
  add column if not exists street_address text,
  add column if not exists property_name text,
  add column if not exists property_type text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists image_url text;

alter table public.maintenance_items
  add column if not exists recurring boolean not null default false,
  add column if not exists interval_days integer,
  add column if not exists priority text default 'medium';

alter table public.repairs
  add column if not exists photo_urls text[] default '{}',
  add column if not exists receipt_url text,
  add column if not exists warranty_expires text;

alter table public.appliances
  add column if not exists category text default '',
  add column if not exists brand text default '',
  add column if not exists model text default '',
  add column if not exists serial text default '',
  add column if not exists install_date text default '',
  add column if not exists purchase_price text default '',
  add column if not exists expected_life_years integer default 10,
  add column if not exists warranty_expires text default '',
  add column if not exists last_service text default '',
  add column if not exists next_service text default '',
  add column if not exists condition text default 'Good',
  add column if not exists notes text default '',
  add column if not exists photo_url text,
  add column if not exists manual_url text,
  add column if not exists receipt_url text;

alter table public.documents
  add column if not exists category text default 'other',
  add column if not exists file_url text,
  add column if not exists file_type text default 'pdf',
  add column if not exists file_size text default '',
  add column if not exists upload_date text default '',
  add column if not exists expires_date text,
  add column if not exists notes text default '',
  add column if not exists tags text[] default '{}';

alter table public.receipts
  add column if not exists file_type text default 'pdf',
  add column if not exists file_size text default '',
  add column if not exists upload_date text default '',
  add column if not exists notes text default '',
  add column if not exists tags text[] default '{}';

alter table public.warranties
  add column if not exists file_type text default 'pdf',
  add column if not exists file_size text default '',
  add column if not exists upload_date text default '',
  add column if not exists expires_date text,
  add column if not exists notes text default '',
  add column if not exists tags text[] default '{}';

alter table public.contractors
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists website text default '',
  add column if not exists last_used text default '',
  add column if not exists license_number text default '';

alter table public.property_scores
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- promo_codes: rename legacy "type" → discount_type
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
  add column if not exists discount_type text not null default 'percent',
  add column if not exists discount_value numeric(10,2) not null default 0,
  add column if not exists plan_scope text not null default 'all',
  add column if not exists max_uses integer,
  add column if not exists used_count integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists expires_at timestamptz;

-- Backfill property_scores.user_id
update public.property_scores ps
set user_id = p.user_id
from public.properties p
where ps.property_id = p.id and ps.user_id is null;

-- ── 4. Deduplicate before unique indexes ─────────────────────────────────────
-- user_roles may have duplicate user_id rows on older deployments; keep the
-- highest-privilege row per user (super_admin first, founders always win).
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_roles'
  ) then
    return;
  end if;

  perform public.ensure_table_timestamps('user_roles');

  -- Promote founder accounts so the surviving row is super_admin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_roles' and column_name = 'updated_at'
  ) then
    update public.user_roles ur
    set role = 'super_admin', updated_at = now()
    where public.is_founder_user(ur.user_id)
      and ur.role is distinct from 'super_admin';
  else
    update public.user_roles ur
    set role = 'super_admin'
    where public.is_founder_user(ur.user_id)
      and ur.role is distinct from 'super_admin';
  end if;

  delete from public.user_roles ur
  using (
    select id
    from (
      select
        id,
        row_number() over (
          partition by user_id
          order by
            case when public.is_founder_user(user_id) then 0 else 1 end,
            case role
              when 'super_admin' then 0
              when 'moderator' then 1
              when 'support' then 2
              else 3
            end,
            created_at asc nulls last,
            id asc
        ) as rn
      from public.user_roles
    ) ranked
    where rn > 1
  ) dupes
  where ur.id = dupes.id;
end $$;

-- ── 4b. Indexes & unique constraints ────────────────────────────────────────
create unique index if not exists pricing_plans_plan_key_uidx on public.pricing_plans (plan_key);
create unique index if not exists promo_codes_code_uidx on public.promo_codes (code);
create unique index if not exists property_scores_property_id_uidx on public.property_scores (property_id);
create unique index if not exists user_roles_user_id_uidx on public.user_roles (user_id);
create unique index if not exists user_entitlements_user_entitlement_uidx
  on public.user_entitlements (user_id, entitlement);

-- ── 5. updated_at triggers ──────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'properties','maintenance_items','repairs','appliances','documents',
    'receipts','warranties','photos','contractors','paint_colors',
    'pricing_plans','promo_codes','user_roles','profiles','subscriptions','support_tickets'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      perform public.ensure_table_timestamps(t);
      execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'updated_at'
      ) then
        execute format(
          'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
          t, t
        );
      end if;
    end if;
  end loop;
end $$;

-- ── 6. RLS helper: per-operation user-owned CRUD ────────────────────────────
create or replace function public.apply_user_owned_rls(p_table text)
returns void
language plpgsql as $$
declare
  op text;
  ops text[] := array['select', 'insert', 'update', 'delete'];
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'user_id'
  ) then
    return;
  end if;

  execute format('alter table public.%I enable row level security', p_table);

  -- Drop legacy bundled policies (root cause of INSERT failures on some deployments)
  execute format('drop policy if exists "Users manage own %I" on public.%I', p_table, p_table);

  foreach op in array ops loop
    execute format('drop policy if exists %I on public.%I', p_table || '_' || op || '_own', p_table);
  end loop;

  execute format(
    'create policy "%I_select_own" on public.%I for select using (auth.uid() = user_id)',
    p_table, p_table
  );
  execute format(
    'create policy "%I_insert_own" on public.%I for insert with check (auth.uid() = user_id)',
    p_table, p_table
  );
  execute format(
    'create policy "%I_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
    p_table, p_table
  );
  execute format(
    'create policy "%I_delete_own" on public.%I for delete using (auth.uid() = user_id)',
    p_table, p_table
  );

  execute format('drop policy if exists "Admins read all %I" on public.%I', p_table, p_table);
  execute format(
    'create policy "Admins read all %I" on public.%I for select using (public.is_super_admin())',
    p_table, p_table
  );
end;
$$;

-- Apply to all user-owned data tables
do $$
declare t text;
begin
  foreach t in array array[
    'maintenance_items',
    'repairs',
    'appliances',
    'contractors',
    'documents',
    'receipts',
    'warranties',
    'paint_colors',
    'photos',
    'properties',
    'reports',
    'property_shares',
    'contractor_portal_access',
    'maintenance_forecasts',
    'property_scores',
    'push_tokens',
    'stripe_customers'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      perform public.apply_user_owned_rls(t);
    end if;
  end loop;
end $$;

-- user_entitlements & user_roles (special policies)
alter table public.user_entitlements enable row level security;
drop policy if exists "Super admins manage entitlements" on public.user_entitlements;
drop policy if exists "Users read own entitlements" on public.user_entitlements;
create policy "user_entitlements_select_own" on public.user_entitlements
  for select using (auth.uid() = user_id);
create policy "user_entitlements_admin_all" on public.user_entitlements
  for all using (public.is_super_admin());

alter table public.user_roles enable row level security;
drop policy if exists "Users read own role" on public.user_roles;
drop policy if exists "Admins manage roles" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select using (auth.uid() = user_id);
create policy "user_roles_admin_all" on public.user_roles
  for all using (public.is_super_admin());

-- ── 7. pricing_plans RLS ────────────────────────────────────────────────────
alter table public.pricing_plans enable row level security;

drop policy if exists "Anyone reads active pricing" on public.pricing_plans;
drop policy if exists "Admins manage pricing" on public.pricing_plans;

create policy "pricing_plans_select_active" on public.pricing_plans
  for select using (is_active = true or public.is_super_admin());

create policy "pricing_plans_insert_admin" on public.pricing_plans
  for insert with check (public.is_super_admin());

create policy "pricing_plans_update_admin" on public.pricing_plans
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy "pricing_plans_delete_admin" on public.pricing_plans
  for delete using (public.is_super_admin());

-- ── 8. promo_codes RLS (admin-managed; users redeem via RPC) ────────────────
alter table public.promo_codes enable row level security;

drop policy if exists "Admins manage promo codes" on public.promo_codes;

create policy "promo_codes_select_admin" on public.promo_codes
  for select using (public.is_super_admin());

create policy "promo_codes_insert_admin" on public.promo_codes
  for insert with check (public.is_super_admin());

create policy "promo_codes_update_admin" on public.promo_codes
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy "promo_codes_delete_admin" on public.promo_codes
  for delete using (public.is_super_admin());

-- ── 9. notification_broadcasts RLS ──────────────────────────────────────────
alter table public.notification_broadcasts enable row level security;
alter table public.user_broadcast_reads enable row level security;

drop policy if exists "Authenticated read active broadcasts" on public.notification_broadcasts;
drop policy if exists "Admins manage broadcasts" on public.notification_broadcasts;
drop policy if exists "Users manage own broadcast reads" on public.user_broadcast_reads;

create policy "notification_broadcasts_select_active" on public.notification_broadcasts
  for select using (auth.uid() is not null and is_active = true);

create policy "notification_broadcasts_insert_admin" on public.notification_broadcasts
  for insert with check (public.is_super_admin());

create policy "notification_broadcasts_update_admin" on public.notification_broadcasts
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy "notification_broadcasts_delete_admin" on public.notification_broadcasts
  for delete using (public.is_super_admin());

create policy "notification_broadcasts_select_admin" on public.notification_broadcasts
  for select using (public.is_super_admin());

create policy "user_broadcast_reads_all_own" on public.user_broadcast_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 10. Seed pricing_plans ───────────────────────────────────────────────────
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

-- ── 11. Promo RPCs ────────────────────────────────────────────────────────────
alter table public.promo_codes drop constraint if exists promo_codes_discount_type_check;
alter table public.promo_codes add constraint promo_codes_discount_type_check
  check (discount_type in ('percent', 'fixed', 'free_trial', 'lifetime_access', 'owner_grant'));

create or replace function public.validate_promo_code(p_code text, p_plan_key text default 'premium')
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_promo public.promo_codes%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('valid', false, 'error', 'Please sign in to use a promo code.');
  end if;
  select * into v_promo from public.promo_codes where upper(trim(code)) = upper(trim(p_code)) limit 1;
  if not found then return jsonb_build_object('valid', false, 'error', 'Promo code not found.'); end if;
  if not v_promo.is_active then return jsonb_build_object('valid', false, 'error', 'This promo code is no longer active.'); end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    return jsonb_build_object('valid', false, 'error', 'This promo code has expired.');
  end if;
  if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object('valid', false, 'error', 'This promo code has reached its usage limit.');
  end if;
  if v_promo.plan_scope <> 'all' and v_promo.plan_scope <> p_plan_key then
    return jsonb_build_object('valid', false, 'error', 'This code does not apply to the ' || p_plan_key || ' plan.');
  end if;
  return jsonb_build_object('valid', true, 'promo', jsonb_build_object(
    'id', v_promo.id, 'code', v_promo.code, 'description', v_promo.description,
    'discount_type', v_promo.discount_type, 'discount_value', v_promo.discount_value,
    'plan_scope', v_promo.plan_scope, 'max_uses', v_promo.max_uses,
    'used_count', v_promo.used_count, 'is_active', v_promo.is_active, 'expires_at', v_promo.expires_at
  ));
end;
$$;

create or replace function public.redeem_promo_code(p_code text, p_plan_key text default 'premium')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_promo public.promo_codes%rowtype;
  v_grant_plan text;
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Please sign in to redeem a promo code.');
  end if;

  perform public.ensure_table_timestamps('profiles');
  perform public.ensure_table_timestamps('user_roles');
  perform public.ensure_table_timestamps('promo_codes');

  v_result := public.validate_promo_code(p_code, p_plan_key);
  if not (v_result->>'valid')::boolean then
    return jsonb_build_object('success', false, 'error', v_result->>'error');
  end if;
  select * into v_promo from public.promo_codes where upper(trim(code)) = upper(trim(p_code)) limit 1;
  v_grant_plan := case when v_promo.plan_scope = 'all' then p_plan_key else v_promo.plan_scope end;
  case v_promo.discount_type
    when 'lifetime_access', 'free_trial' then
      update public.profiles set plan = v_grant_plan::text, updated_at = now() where id = v_user_id;
      if v_grant_plan in ('premium', 'landlord', 'realtor') then
        insert into public.user_entitlements (user_id, entitlement, granted_by)
        values (v_user_id, v_grant_plan, v_user_id) on conflict (user_id, entitlement) do nothing;
      end if;
    when 'owner_grant' then
      insert into public.user_roles (user_id, role) values (v_user_id, 'super_admin')
        on conflict (user_id) do update set role = 'super_admin', updated_at = now();
      insert into public.user_entitlements (user_id, entitlement, granted_by)
        values (v_user_id, 'owner_access', v_user_id) on conflict (user_id, entitlement) do nothing;
      update public.profiles set plan = 'realtor', updated_at = now() where id = v_user_id;
      v_grant_plan := 'realtor';
    else null;
  end case;
  update public.promo_codes set used_count = used_count + 1, updated_at = now() where id = v_promo.id;
  return jsonb_build_object('success', true, 'granted_plan', v_grant_plan);
end;
$$;

grant execute on function public.validate_promo_code(text, text) to authenticated;
grant execute on function public.redeem_promo_code(text, text) to authenticated;

-- ── 12. Founder protection (full) ─────────────────────────────────────────────
create or replace function public.ensure_founder_full_access(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_founder_user(p_user_id) then return; end if;

  perform public.ensure_table_timestamps('user_roles');
  perform public.ensure_table_timestamps('profiles');

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'super_admin')
  on conflict (user_id) do update set role = 'super_admin', updated_at = now();

  insert into public.user_entitlements (user_id, entitlement, granted_by)
  select p_user_id, e.entitlement, p_user_id
  from (values ('owner_access'), ('premium'), ('landlord'), ('realtor')) as e(entitlement)
  on conflict (user_id, entitlement) do nothing;

  update public.profiles set plan = 'realtor', updated_at = now()
  where id = p_user_id and plan = 'free';
end;
$$;

grant execute on function public.ensure_founder_full_access(uuid) to authenticated;

create or replace function public.protect_founder_profile_delete()
returns trigger language plpgsql as $$
begin
  if public.is_founder_email(old.email) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_founder_profile_delete on public.profiles;
create trigger protect_founder_profile_delete
  before delete on public.profiles
  for each row execute function public.protect_founder_profile_delete();

create or replace function public.ensure_founder_on_profile_insert()
returns trigger language plpgsql as $$
begin
  if public.is_founder_email(new.email) then
    perform public.ensure_founder_full_access(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_founder_on_profile_insert on public.profiles;
create trigger ensure_founder_on_profile_insert
  after insert on public.profiles
  for each row execute function public.ensure_founder_on_profile_insert();

create or replace function public.protect_founder_user_roles()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if public.is_founder_user(old.user_id) then
      raise exception 'This account is protected and cannot be modified.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and public.is_founder_user(old.user_id)
     and old.role = 'super_admin' and new.role is distinct from 'super_admin' then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_founder_user_roles on public.user_roles;
create trigger protect_founder_user_roles
  before update or delete on public.user_roles
  for each row execute function public.protect_founder_user_roles();

create or replace function public.ensure_founder_user_roles()
returns trigger language plpgsql as $$
begin
  if public.is_founder_user(new.user_id) and new.role is distinct from 'super_admin' then
    new.role := 'super_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_founder_user_roles on public.user_roles;
create trigger ensure_founder_user_roles
  before insert or update on public.user_roles
  for each row execute function public.ensure_founder_user_roles();

create or replace function public.protect_founder_entitlements()
returns trigger language plpgsql as $$
begin
  if public.is_founder_user(old.user_id) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_founder_entitlements on public.user_entitlements;
create trigger protect_founder_entitlements
  before delete on public.user_entitlements
  for each row execute function public.protect_founder_entitlements();

create or replace function public.protect_founder_profile_update()
returns trigger language plpgsql as $$
begin
  if public.is_founder_email(old.email) and new.plan = 'free' then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_founder_profile_update on public.profiles;
create trigger protect_founder_profile_update
  before update on public.profiles
  for each row execute function public.protect_founder_profile_update();

-- profiles RLS (column is id, not user_id)
alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_super_admin());

create or replace function public.bootstrap_owner_admin()
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_email text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select email into v_email from auth.users where id = v_user_id;
  if not public.is_founder_email(v_email) then raise exception 'Not authorized'; end if;
  perform public.ensure_founder_full_access(v_user_id);
end;
$$;

grant execute on function public.bootstrap_owner_admin() to authenticated;

-- Restore founder access for existing accounts
do $$
declare r record;
begin
  for r in select u.id from auth.users u where public.is_founder_email(u.email::text) loop
    perform public.ensure_founder_full_access(r.id);
  end loop;
end $$;

-- ── 13. Post-migration verification (informational) ─────────────────────────
-- Run manually after apply:
--   select tablename, policyname, cmd from pg_policies
--     where schemaname = 'public'
--     and tablename in ('maintenance_items','repairs','appliances','contractors','documents')
--     order by 1, 2;
--   select column_name from information_schema.columns
--     where table_name = 'documents' and column_name = 'upload_date';
