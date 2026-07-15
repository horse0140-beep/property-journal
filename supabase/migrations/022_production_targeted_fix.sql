-- ═══════════════════════════════════════════════════════════════════════════
-- HomeWise 022 — Production Targeted Fix (audit FINAL_SUMMARY only)
-- Idempotent · data-safe · rerunnable · does NOT run or replace 021.
--
-- PRODUCTION SAFETY AUDIT (no data removal):
--   ✓ No DROP TABLE / DROP COLUMN / TRUNCATE / DELETE FROM
--   ✓ No RENAME COLUMN / ALTER COLUMN TYPE / ALTER COLUMN DROP
--   ✓ All CREATE TABLE use IF NOT EXISTS
--   ✓ All ADD COLUMN use IF NOT EXISTS
--   ✓ UPDATE only fills NULL discount_type or NULL updated_at (never overwrites)
--   ✓ DROP TRIGGER IF EXISTS / DROP POLICY IF EXISTS affect metadata only, not rows
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.hw_table_exists(p_table text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table and table_type = 'BASE TABLE'
  );
$$;

create or replace function public.hw_column_exists(p_table text, p_column text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_column
  );
$$;

create or replace function public.hw_trigger_exists(p_trigger text, p_table text)
returns boolean language sql stable as $$
  select exists (
    select 1 from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = p_table and tg.tgname = p_trigger
      and not tg.tgisinternal
  );
$$;

create or replace function public.hw_attach_updated_at_trigger(p_table text)
returns void language plpgsql as $$
declare v_trigger text := p_table || '_updated_at';
begin
  if not public.hw_table_exists(p_table) or not public.hw_column_exists(p_table, 'updated_at') then
    return;
  end if;
  if public.hw_trigger_exists(v_trigger, p_table) then
    return;
  end if;
  execute format(
    'create trigger %I before update on public.%I
     for each row execute function public.set_updated_at()',
    v_trigger, p_table
  );
end;
$$;

create or replace function public.hw_ensure_trigger(
  p_trigger text,
  p_table text,
  p_definition text
)
returns void language plpgsql as $$
begin
  if not public.hw_table_exists(p_table) then
    return;
  end if;
  if public.hw_trigger_exists(p_trigger, p_table) then
    return;
  end if;
  execute p_definition;
end;
$$;

-- ── Phase 1: Missing tables (CREATE IF NOT EXISTS only) ─────────────────────
create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sent_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_broadcast_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  broadcast_id uuid references public.notification_broadcasts(id) on delete cascade not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, broadcast_id)
);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.maintenance_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id text not null,
  summary text not null,
  items jsonb not null default '[]',
  annual_budget text not null default '$0',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, property_id)
);

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

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

-- Patch pre-existing table skeletons (IF NOT EXISTS only)
alter table public.notification_broadcasts add column if not exists updated_at timestamptz default now();
alter table public.admin_actions add column if not exists updated_at timestamptz default now();
alter table public.maintenance_forecasts add column if not exists created_at timestamptz default now();
alter table public.maintenance_forecasts add column if not exists updated_at timestamptz default now();
alter table public.user_broadcast_reads add column if not exists id uuid default gen_random_uuid();
alter table public.user_broadcast_reads add column if not exists created_at timestamptz default now();
alter table public.user_broadcast_reads add column if not exists updated_at timestamptz default now();

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_user_idx on public.admin_actions (target_user_id);
create unique index if not exists push_tokens_user_token_uidx on public.push_tokens (user_id, token);
create unique index if not exists stripe_customers_user_id_uidx on public.stripe_customers (user_id);
create unique index if not exists maintenance_forecasts_user_property_uidx
  on public.maintenance_forecasts (user_id, property_id);
create unique index if not exists user_broadcast_reads_user_broadcast_uidx
  on public.user_broadcast_reads (user_id, broadcast_id);

-- ── Phase 2: Missing columns (FINAL_SUMMARY only) ───────────────────────────
alter table public.documents add column if not exists tags text[] default '{}';
alter table public.documents add column if not exists updated_at timestamptz default now();
alter table public.documents add column if not exists upload_date text default '';

alter table public.receipts add column if not exists file_type text default 'pdf';
alter table public.receipts add column if not exists tags text[] default '{}';
alter table public.receipts add column if not exists updated_at timestamptz default now();
alter table public.receipts add column if not exists upload_date text default '';

alter table public.warranties add column if not exists file_type text default 'pdf';
alter table public.warranties add column if not exists tags text[] default '{}';
alter table public.warranties add column if not exists updated_at timestamptz default now();
alter table public.warranties add column if not exists upload_date text default '';

alter table public.appliances add column if not exists updated_at timestamptz default now();
alter table public.contractors add column if not exists updated_at timestamptz default now();
alter table public.maintenance_items add column if not exists updated_at timestamptz default now();
alter table public.paint_colors add column if not exists updated_at timestamptz default now();

alter table public.photos add column if not exists caption text default '';
alter table public.photos add column if not exists date text default '';
alter table public.photos add column if not exists file_url text default '';
alter table public.photos add column if not exists updated_at timestamptz default now();

alter table public.pricing_plans add column if not exists updated_at timestamptz default now();

alter table public.profiles add column if not exists admin_broadcasts boolean default true;
alter table public.profiles add column if not exists appliance_reminders boolean default true;
alter table public.profiles add column if not exists subscription_reminders boolean default true;
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.promo_codes add column if not exists description text;
alter table public.promo_codes add column if not exists discount_type text default 'percent';
alter table public.promo_codes add column if not exists discount_value numeric(10,2) default 0;
alter table public.promo_codes add column if not exists plan_scope text default 'all';
alter table public.promo_codes add column if not exists updated_at timestamptz default now();
alter table public.promo_codes add column if not exists used_count integer default 0;

alter table public.properties add column if not exists updated_at timestamptz default now();

alter table public.property_scores add column if not exists appliances integer default 0;
alter table public.property_scores add column if not exists inspections integer default 0;
alter table public.property_scores add column if not exists label text default 'Fair';
alter table public.property_scores add column if not exists maintenance integer default 0;
alter table public.property_scores add column if not exists overall integer default 0;
alter table public.property_scores add column if not exists repairs integer default 0;
alter table public.property_scores add column if not exists warranty integer default 0;

alter table public.support_tickets add column if not exists admin_notes text;
alter table public.support_tickets add column if not exists updated_at timestamptz default now();
alter table public.support_tickets add column if not exists user_email text;

alter table public.user_entitlements
  add column if not exists granted_by uuid references auth.users(id) on delete set null;

-- ── Phase 3: Legacy promo — copy only, never rename or delete ───────────────
do $$
begin
  if public.hw_column_exists('promo_codes', 'type')
     and public.hw_column_exists('promo_codes', 'discount_type') then
    update public.promo_codes
    set discount_type = type::text
    where discount_type is null;
  end if;
end $$;

-- Backfill null updated_at only (never overwrite existing timestamps)
do $$
declare t text;
begin
  foreach t in array array[
    'documents','receipts','warranties','appliances','contractors',
    'maintenance_items','paint_colors','photos','pricing_plans','profiles',
    'properties','promo_codes','support_tickets','notification_broadcasts',
    'admin_actions','contractor_portal_access','maintenance_forecasts',
    'stripe_customers','push_tokens','user_broadcast_reads'
  ] loop
    if public.hw_column_exists(t, 'updated_at') and public.hw_column_exists(t, 'created_at') then
      execute format(
        'update public.%I set updated_at = created_at where updated_at is null',
        t
      );
    elsif public.hw_column_exists(t, 'updated_at') then
      execute format(
        'update public.%I set updated_at = now() where updated_at is null',
        t
      );
    end if;
  end loop;
end $$;

-- ── Phase 4: updated_at triggers (skip if already attached) ─────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'documents','receipts','warranties','appliances','contractors',
    'maintenance_items','paint_colors','photos','pricing_plans','profiles',
    'properties','promo_codes','support_tickets','notification_broadcasts',
    'admin_actions','contractor_portal_access','maintenance_forecasts',
    'stripe_customers','push_tokens','user_broadcast_reads'
  ] loop
    perform public.hw_attach_updated_at_trigger(t);
  end loop;
end $$;

-- ── Phase 5: Founder protection (block changes — never modify founders) ─────
create or replace function public.founder_emails()
returns text[] language sql immutable as $$
  select array['horse0140@gmail.com', 'hdmccoy180@gmail.com']::text[];
$$;

create or replace function public.is_founder_email(p_email text)
returns boolean language sql immutable as $$
  select lower(trim(coalesce(p_email, ''))) = any (
    select lower(e) from unnest(public.founder_emails()) as e
  );
$$;

create or replace function public.is_founder_user(p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and public.is_founder_email(u.email::text)
  );
$$;

create or replace function public.is_super_admin()
returns boolean language plpgsql security definer stable set search_path = public as $$
begin
  if public.hw_table_exists('user_roles')
     and exists (
       select 1 from public.user_roles
       where user_id = auth.uid() and role = 'super_admin'
     ) then
    return true;
  end if;
  return exists (
    select 1 from auth.users u
    where u.id = auth.uid() and public.is_founder_email(u.email::text)
  );
end;
$$;

create or replace function public.protect_founder_profile_delete()
returns trigger language plpgsql as $$
begin
  if public.is_founder_email(old.email) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return old;
end;
$$;

create or replace function public.protect_founder_profile_update()
returns trigger language plpgsql as $$
begin
  if public.is_founder_email(old.email)
     and (new.plan is distinct from old.plan or new.email is distinct from old.email) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_founder_user_roles()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and public.is_founder_user(old.user_id) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  if tg_op = 'UPDATE' and public.is_founder_user(old.user_id)
     and new.role is distinct from old.role then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.protect_founder_entitlements()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and public.is_founder_user(old.user_id) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return old;
end;
$$;

-- Founder protection triggers (create only if missing — never DROP)
select public.hw_ensure_trigger(
  'protect_founder_profile_delete',
  'profiles',
  'create trigger protect_founder_profile_delete before delete on public.profiles
   for each row execute function public.protect_founder_profile_delete()'
);

select public.hw_ensure_trigger(
  'protect_founder_profile_update',
  'profiles',
  'create trigger protect_founder_profile_update before update on public.profiles
   for each row execute function public.protect_founder_profile_update()'
);

select public.hw_ensure_trigger(
  'protect_founder_user_roles',
  'user_roles',
  'create trigger protect_founder_user_roles before update or delete on public.user_roles
   for each row execute function public.protect_founder_user_roles()'
);

select public.hw_ensure_trigger(
  'protect_founder_entitlements',
  'user_entitlements',
  'create trigger protect_founder_entitlements before delete on public.user_entitlements
   for each row execute function public.protect_founder_entitlements()'
);

-- No founder backfill / role upsert in this migration (preserves existing state)

-- ── Phase 6: RLS repair (five user-owned tables) ─────────────────────────────
create or replace function public.hw_apply_user_rls(p_table text)
returns void language plpgsql as $$
declare op text;
  ops text[] := array['select','insert','update','delete'];
begin
  if not public.hw_table_exists(p_table) or not public.hw_column_exists(p_table, 'user_id') then
    return;
  end if;

  execute format('alter table public.%I enable row level security', p_table);
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
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'maintenance_items','repairs','appliances','contractors','documents'
  ] loop
    perform public.hw_apply_user_rls(t);
  end loop;
end $$;

-- Minimal RLS on newly created user-owned tables (no data changes)
do $$
begin
  if public.hw_table_exists('push_tokens') then
    alter table public.push_tokens enable row level security;
    drop policy if exists "Users manage own push tokens" on public.push_tokens;
    create policy "Users manage own push tokens" on public.push_tokens
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if public.hw_table_exists('contractor_portal_access') then
    alter table public.contractor_portal_access enable row level security;
    drop policy if exists "Users manage own contractor access" on public.contractor_portal_access;
    create policy "Users manage own contractor access" on public.contractor_portal_access
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if public.hw_table_exists('maintenance_forecasts') then
    alter table public.maintenance_forecasts enable row level security;
    drop policy if exists "Users manage own forecasts" on public.maintenance_forecasts;
    create policy "Users manage own forecasts" on public.maintenance_forecasts
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if public.hw_table_exists('stripe_customers') then
    alter table public.stripe_customers enable row level security;
    drop policy if exists "Users read own stripe record" on public.stripe_customers;
    drop policy if exists "Users upsert own stripe record" on public.stripe_customers;
    drop policy if exists "Users update own stripe record" on public.stripe_customers;
    create policy "Users read own stripe record" on public.stripe_customers
      for select using (auth.uid() = user_id);
    create policy "Users upsert own stripe record" on public.stripe_customers
      for insert with check (auth.uid() = user_id);
    create policy "Users update own stripe record" on public.stripe_customers
      for update using (auth.uid() = user_id);
  end if;

  if public.hw_table_exists('notification_broadcasts') then
    alter table public.notification_broadcasts enable row level security;
    drop policy if exists "Authenticated read active broadcasts" on public.notification_broadcasts;
    drop policy if exists "Admins manage broadcasts" on public.notification_broadcasts;
    create policy "Authenticated read active broadcasts" on public.notification_broadcasts
      for select using (auth.uid() is not null and is_active = true);
    create policy "Admins manage broadcasts" on public.notification_broadcasts
      for all using (public.is_super_admin());
  end if;

  if public.hw_table_exists('user_broadcast_reads') then
    alter table public.user_broadcast_reads enable row level security;
    drop policy if exists "Users manage own broadcast reads" on public.user_broadcast_reads;
    create policy "Users manage own broadcast reads" on public.user_broadcast_reads
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if public.hw_table_exists('admin_actions') then
    alter table public.admin_actions enable row level security;
    drop policy if exists "Super admins read admin_actions" on public.admin_actions;
    drop policy if exists "Super admins insert admin_actions" on public.admin_actions;
    create policy "Super admins read admin_actions" on public.admin_actions
      for select using (public.is_super_admin());
    create policy "Super admins insert admin_actions" on public.admin_actions
      for insert with check (public.is_super_admin());
  end if;
end $$;
