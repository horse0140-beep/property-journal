-- ═══════════════════════════════════════════════════════════════════════════
-- HomeWise 021 — True Schema Reconciliation (STRICTLY IDEMPOTENT)
-- Safe on production databases at any state from migrations 000–020.
--
-- ORDER: helpers → create tables → add columns → renames → dedup → indexes
--        → triggers → functions → RLS → seed → founder restore
-- Never references a column before Phase 3 creates it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PHASE 1: Helpers (no assumed columns) ───────────────────────────────────
create or replace function public.hw_table_exists(p_table text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table
  );
$$;

create or replace function public.hw_column_exists(p_table text, p_column text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_column
  );
$$;

create or replace function public.hw_add_column(p_table text, p_ddl text)
returns void language plpgsql as $$
begin
  if not public.hw_table_exists(p_table) then return; end if;
  execute format('alter table public.%I add column if not exists %s', p_table, p_ddl);
end;
$$;

create or replace function public.hw_ensure_timestamps(p_table text)
returns void language plpgsql as $$
begin
  if not public.hw_table_exists(p_table) then return; end if;
  perform public.hw_add_column(p_table, 'created_at timestamptz default now()');
  perform public.hw_add_column(p_table, 'updated_at timestamptz default now()');
  if public.hw_column_exists(p_table, 'created_at') then
    execute format('update public.%I set created_at = now() where created_at is null', p_table);
  end if;
  if public.hw_column_exists(p_table, 'updated_at') then
    execute format(
      'update public.%I set updated_at = coalesce(updated_at, now()) where updated_at is null',
      p_table
    );
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── PHASE 2: Create missing tables (skeleton PK only) ───────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.maintenance_items (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.appliances (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.paint_colors (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.property_scores (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid()
);
create table if not exists public.user_broadcast_reads (
  user_id uuid not null,
  broadcast_id uuid not null,
  primary key (user_id, broadcast_id)
);

-- ── PHASE 3: Add every column the app references ────────────────────────────

-- profiles (AuthContext, adminService, subscriptionService)
select public.hw_add_column('profiles', 'email text');
select public.hw_add_column('profiles', 'name text');
select public.hw_add_column('profiles', 'phone text');
select public.hw_add_column('profiles', 'avatar_uri text');
select public.hw_add_column('profiles', 'plan text default ''free''');
select public.hw_add_column('profiles', 'notifications_enabled boolean default true');
select public.hw_add_column('profiles', 'maintenance_reminders boolean default true');
select public.hw_add_column('profiles', 'warranty_alerts boolean default true');
select public.hw_add_column('profiles', 'email_digest boolean default false');
select public.hw_add_column('profiles', 'appliance_reminders boolean default true');
select public.hw_add_column('profiles', 'subscription_reminders boolean default true');
select public.hw_add_column('profiles', 'admin_broadcasts boolean default true');
select public.hw_add_column('profiles', 'created_at timestamptz default now()');
select public.hw_add_column('profiles', 'updated_at timestamptz default now()');

-- user_roles
select public.hw_add_column('user_roles', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('user_roles', 'role text default ''user''');
select public.hw_add_column('user_roles', 'created_at timestamptz default now()');
select public.hw_add_column('user_roles', 'updated_at timestamptz default now()');

-- user_entitlements
select public.hw_add_column('user_entitlements', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('user_entitlements', 'entitlement text');
select public.hw_add_column('user_entitlements', 'granted_by uuid references auth.users(id) on delete set null');
select public.hw_add_column('user_entitlements', 'created_at timestamptz default now()');

-- pricing_plans (pricingService, adminService)
select public.hw_add_column('pricing_plans', 'plan_key text');
select public.hw_add_column('pricing_plans', 'name text');
select public.hw_add_column('pricing_plans', 'monthly_price numeric(10,2) default 0');
select public.hw_add_column('pricing_plans', 'yearly_price numeric(10,2) default 0');
select public.hw_add_column('pricing_plans', 'description text');
select public.hw_add_column('pricing_plans', 'features text[] default ''{}''');
select public.hw_add_column('pricing_plans', 'is_active boolean default true');
select public.hw_add_column('pricing_plans', 'sort_order integer default 0');
select public.hw_add_column('pricing_plans', 'created_at timestamptz default now()');
select public.hw_add_column('pricing_plans', 'updated_at timestamptz default now()');

-- promo_codes (promoService, adminService)
select public.hw_add_column('promo_codes', 'code text');
select public.hw_add_column('promo_codes', 'description text');
select public.hw_add_column('promo_codes', 'discount_type text default ''percent''');
select public.hw_add_column('promo_codes', 'discount_value numeric(10,2) default 0');
select public.hw_add_column('promo_codes', 'plan_scope text default ''all''');
select public.hw_add_column('promo_codes', 'max_uses integer');
select public.hw_add_column('promo_codes', 'used_count integer default 0');
select public.hw_add_column('promo_codes', 'is_active boolean default true');
select public.hw_add_column('promo_codes', 'expires_at timestamptz');
select public.hw_add_column('promo_codes', 'created_at timestamptz default now()');
select public.hw_add_column('promo_codes', 'updated_at timestamptz default now()');

-- properties (propertyService / types/database.ts)
select public.hw_add_column('properties', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('properties', 'nickname text');
select public.hw_add_column('properties', 'address text default ''''');
select public.hw_add_column('properties', 'city text default ''''');
select public.hw_add_column('properties', 'state text default ''''');
select public.hw_add_column('properties', 'zip text default ''''');
select public.hw_add_column('properties', 'type text default ''primary''');
select public.hw_add_column('properties', 'property_type text');
select public.hw_add_column('properties', 'property_name text');
select public.hw_add_column('properties', 'street_address text');
select public.hw_add_column('properties', 'year_built text default ''''');
select public.hw_add_column('properties', 'square_feet text default ''''');
select public.hw_add_column('properties', 'bedrooms text default ''''');
select public.hw_add_column('properties', 'bathrooms text default ''''');
select public.hw_add_column('properties', 'purchase_price text default ''''');
select public.hw_add_column('properties', 'estimated_value text default ''''');
select public.hw_add_column('properties', 'value numeric');
select public.hw_add_column('properties', 'purchase_date text default ''''');
select public.hw_add_column('properties', 'photo_url text');
select public.hw_add_column('properties', 'image_url text');
select public.hw_add_column('properties', 'is_selected boolean default false');
select public.hw_add_column('properties', 'is_primary boolean default false');
select public.hw_add_column('properties', 'is_active boolean default true');
select public.hw_add_column('properties', 'created_at timestamptz default now()');
select public.hw_add_column('properties', 'updated_at timestamptz default now()');

-- maintenance_items
select public.hw_add_column('maintenance_items', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('maintenance_items', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('maintenance_items', 'title text');
select public.hw_add_column('maintenance_items', 'category text default ''''');
select public.hw_add_column('maintenance_items', 'last_completed text default ''''');
select public.hw_add_column('maintenance_items', 'next_due text default ''''');
select public.hw_add_column('maintenance_items', 'status text default ''Upcoming''');
select public.hw_add_column('maintenance_items', 'notes text default ''''');
select public.hw_add_column('maintenance_items', 'recurring boolean default false');
select public.hw_add_column('maintenance_items', 'interval_days integer');
select public.hw_add_column('maintenance_items', 'priority text default ''medium''');
select public.hw_add_column('maintenance_items', 'created_at timestamptz default now()');
select public.hw_add_column('maintenance_items', 'updated_at timestamptz default now()');

-- repairs
select public.hw_add_column('repairs', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('repairs', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('repairs', 'title text');
select public.hw_add_column('repairs', 'date text default ''''');
select public.hw_add_column('repairs', 'cost text default ''''');
select public.hw_add_column('repairs', 'contractor text default ''''');
select public.hw_add_column('repairs', 'category text default ''''');
select public.hw_add_column('repairs', 'notes text default ''''');
select public.hw_add_column('repairs', 'photo_urls text[] default ''{}''');
select public.hw_add_column('repairs', 'receipt_url text');
select public.hw_add_column('repairs', 'warranty_expires text');
select public.hw_add_column('repairs', 'created_at timestamptz default now()');
select public.hw_add_column('repairs', 'updated_at timestamptz default now()');

-- appliances
select public.hw_add_column('appliances', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('appliances', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('appliances', 'name text');
select public.hw_add_column('appliances', 'category text default ''''');
select public.hw_add_column('appliances', 'brand text default ''''');
select public.hw_add_column('appliances', 'model text default ''''');
select public.hw_add_column('appliances', 'serial text default ''''');
select public.hw_add_column('appliances', 'serial_number text default ''''');
select public.hw_add_column('appliances', 'install_date text default ''''');
select public.hw_add_column('appliances', 'purchase_date text default ''''');
select public.hw_add_column('appliances', 'purchase_price numeric');
select public.hw_add_column('appliances', 'expected_life_years integer default 10');
select public.hw_add_column('appliances', 'warranty_expires text default ''''');
select public.hw_add_column('appliances', 'warranty_expiration text default ''''');
select public.hw_add_column('appliances', 'last_service text default ''''');
select public.hw_add_column('appliances', 'next_service text default ''''');
select public.hw_add_column('appliances', 'condition text default ''Good''');
select public.hw_add_column('appliances', 'notes text default ''''');
select public.hw_add_column('appliances', 'photo_url text');
select public.hw_add_column('appliances', 'manual_url text');
select public.hw_add_column('appliances', 'receipt_url text');
select public.hw_add_column('appliances', 'created_at timestamptz default now()');
select public.hw_add_column('appliances', 'updated_at timestamptz default now()');

-- contractors
select public.hw_add_column('contractors', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('contractors', 'property_id uuid references public.properties(id) on delete set null');
select public.hw_add_column('contractors', 'name text');
select public.hw_add_column('contractors', 'trade text default ''''');
select public.hw_add_column('contractors', 'phone text default ''''');
select public.hw_add_column('contractors', 'email text default ''''');
select public.hw_add_column('contractors', 'website text default ''''');
select public.hw_add_column('contractors', 'rating integer default 5');
select public.hw_add_column('contractors', 'notes text default ''''');
select public.hw_add_column('contractors', 'last_used text default ''''');
select public.hw_add_column('contractors', 'license_number text default ''''');
select public.hw_add_column('contractors', 'created_at timestamptz default now()');
select public.hw_add_column('contractors', 'updated_at timestamptz default now()');

-- documents (upload_date required by types/database.ts)
select public.hw_add_column('documents', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('documents', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('documents', 'title text');
select public.hw_add_column('documents', 'category text default ''other''');
select public.hw_add_column('documents', 'file_url text');
select public.hw_add_column('documents', 'file_type text default ''pdf''');
select public.hw_add_column('documents', 'file_size text default ''''');
select public.hw_add_column('documents', 'upload_date text default ''''');
select public.hw_add_column('documents', 'expires_date text');
select public.hw_add_column('documents', 'notes text default ''''');
select public.hw_add_column('documents', 'tags text[] default ''{}''');
select public.hw_add_column('documents', 'created_at timestamptz default now()');
select public.hw_add_column('documents', 'updated_at timestamptz default now()');

-- receipts
select public.hw_add_column('receipts', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('receipts', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('receipts', 'title text');
select public.hw_add_column('receipts', 'file_url text');
select public.hw_add_column('receipts', 'file_type text default ''pdf''');
select public.hw_add_column('receipts', 'file_size text default ''''');
select public.hw_add_column('receipts', 'upload_date text default ''''');
select public.hw_add_column('receipts', 'notes text default ''''');
select public.hw_add_column('receipts', 'tags text[] default ''{}''');
select public.hw_add_column('receipts', 'created_at timestamptz default now()');
select public.hw_add_column('receipts', 'updated_at timestamptz default now()');

-- warranties
select public.hw_add_column('warranties', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('warranties', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('warranties', 'title text');
select public.hw_add_column('warranties', 'file_url text');
select public.hw_add_column('warranties', 'file_type text default ''pdf''');
select public.hw_add_column('warranties', 'file_size text default ''''');
select public.hw_add_column('warranties', 'upload_date text default ''''');
select public.hw_add_column('warranties', 'expires_date text');
select public.hw_add_column('warranties', 'notes text default ''''');
select public.hw_add_column('warranties', 'tags text[] default ''{}''');
select public.hw_add_column('warranties', 'created_at timestamptz default now()');
select public.hw_add_column('warranties', 'updated_at timestamptz default now()');

-- paint_colors
select public.hw_add_column('paint_colors', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('paint_colors', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('paint_colors', 'room text');
select public.hw_add_column('paint_colors', 'brand text default ''''');
select public.hw_add_column('paint_colors', 'color_name text default ''''');
select public.hw_add_column('paint_colors', 'color_code text default ''''');
select public.hw_add_column('paint_colors', 'finish text default ''''');
select public.hw_add_column('paint_colors', 'hex text default ''''');
select public.hw_add_column('paint_colors', 'purchase_date text default ''''');
select public.hw_add_column('paint_colors', 'notes text default ''''');
select public.hw_add_column('paint_colors', 'created_at timestamptz default now()');
select public.hw_add_column('paint_colors', 'updated_at timestamptz default now()');

-- photos (vaultService)
select public.hw_add_column('photos', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('photos', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('photos', 'file_url text default ''''');
select public.hw_add_column('photos', 'caption text default ''''');
select public.hw_add_column('photos', 'date text default ''''');
select public.hw_add_column('photos', 'category text default ''general''');
select public.hw_add_column('photos', 'created_at timestamptz default now()');
select public.hw_add_column('photos', 'updated_at timestamptz default now()');

-- property_scores (scoreService)
select public.hw_add_column('property_scores', 'user_id uuid references auth.users(id) on delete cascade');
select public.hw_add_column('property_scores', 'property_id uuid references public.properties(id) on delete cascade');
select public.hw_add_column('property_scores', 'overall integer default 0');
select public.hw_add_column('property_scores', 'maintenance integer default 0');
select public.hw_add_column('property_scores', 'appliances integer default 0');
select public.hw_add_column('property_scores', 'repairs integer default 0');
select public.hw_add_column('property_scores', 'warranty integer default 0');
select public.hw_add_column('property_scores', 'inspections integer default 0');
select public.hw_add_column('property_scores', 'label text default ''Fair''');
select public.hw_add_column('property_scores', 'updated_at timestamptz default now()');

-- notification_broadcasts (notificationService)
select public.hw_add_column('notification_broadcasts', 'title text');
select public.hw_add_column('notification_broadcasts', 'body text');
select public.hw_add_column('notification_broadcasts', 'sent_by uuid references auth.users(id) on delete set null');
select public.hw_add_column('notification_broadcasts', 'is_active boolean default true');
select public.hw_add_column('notification_broadcasts', 'created_at timestamptz default now()');

select public.hw_add_column('user_broadcast_reads', 'read_at timestamptz default now()');

-- Timestamp backfill for tables that use updated_at
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','pricing_plans','promo_codes','properties',
    'maintenance_items','repairs','appliances','contractors','documents',
    'receipts','warranties','paint_colors','photos'
  ] loop
    perform public.hw_ensure_timestamps(t);
  end loop;
end $$;

-- ── PHASE 4: Legacy column renames / copies ─────────────────────────────────
do $$
begin
  if public.hw_column_exists('promo_codes', 'type')
     and not public.hw_column_exists('promo_codes', 'discount_type') then
    alter table public.promo_codes rename column type to discount_type;
  elsif public.hw_column_exists('promo_codes', 'type')
        and public.hw_column_exists('promo_codes', 'discount_type') then
    update public.promo_codes
    set discount_type = type::text
    where discount_type is null or trim(discount_type) = '';
  end if;
end $$;

-- ── PHASE 5: Deduplicate before unique indexes ─────────────────────────────
do $$
declare v_order text;
begin
  -- user_roles: keep highest privilege row per user_id
  if public.hw_table_exists('user_roles')
     and public.hw_column_exists('user_roles', 'user_id')
     and public.hw_column_exists('user_roles', 'id') then

    if public.hw_column_exists('user_roles', 'role') then
      if public.hw_column_exists('user_roles', 'updated_at') then
        execute $sql$
          update public.user_roles ur set role = 'super_admin', updated_at = now()
          where exists (
            select 1 from auth.users u where u.id = ur.user_id
              and lower(trim(u.email::text)) in ('horse0140@gmail.com','hdmccoy180@gmail.com')
          ) and ur.role is distinct from 'super_admin'
        $sql$;
      else
        execute $sql$
          update public.user_roles ur set role = 'super_admin'
          where exists (
            select 1 from auth.users u where u.id = ur.user_id
              and lower(trim(u.email::text)) in ('horse0140@gmail.com','hdmccoy180@gmail.com')
          ) and ur.role is distinct from 'super_admin'
        $sql$;
      end if;

      v_order := 'case role when ''super_admin'' then 0 when ''moderator'' then 1 when ''support'' then 2 else 3 end';
    else
      v_order := '1';
    end if;

    if public.hw_column_exists('user_roles', 'created_at') then
      v_order := v_order || ', created_at asc nulls last';
    end if;
    v_order := v_order || ', id asc';

    execute format($fmt$
      delete from public.user_roles ur using (
        select id from (
          select id, row_number() over (partition by user_id order by %s) rn
          from public.user_roles
        ) d where rn > 1
      ) dup where ur.id = dup.id
    $fmt$, v_order);
  end if;

  -- user_entitlements: keep one row per (user_id, entitlement)
  if public.hw_table_exists('user_entitlements')
     and public.hw_column_exists('user_entitlements', 'user_id')
     and public.hw_column_exists('user_entitlements', 'entitlement') then

    if public.hw_column_exists('user_entitlements', 'id') then
      if public.hw_column_exists('user_entitlements', 'created_at') then
        execute $sql$
          delete from public.user_entitlements ue using (
            select id from (
              select id, row_number() over (
                partition by user_id, entitlement
                order by created_at asc nulls last, id asc
              ) rn from public.user_entitlements
            ) d where rn > 1
          ) dup where ue.id = dup.id
        $sql$;
      else
        execute $sql$
          delete from public.user_entitlements ue using (
            select id from (
              select id, row_number() over (
                partition by user_id, entitlement order by id asc
              ) rn from public.user_entitlements
            ) d where rn > 1
          ) dup where ue.id = dup.id
        $sql$;
      end if;
    else
      execute $sql$
        delete from public.user_entitlements a using public.user_entitlements b
        where a.ctid < b.ctid
          and a.user_id = b.user_id and a.entitlement = b.entitlement
      $sql$;
    end if;
  end if;
end $$;

-- property_scores.user_id backfill (columns must exist)
do $$
begin
  if public.hw_column_exists('property_scores', 'user_id')
     and public.hw_column_exists('property_scores', 'property_id')
     and public.hw_column_exists('properties', 'user_id') then
    update public.property_scores ps
    set user_id = p.user_id
    from public.properties p
    where ps.property_id = p.id and ps.user_id is null;
  end if;
end $$;

-- ── PHASE 6: Indexes (after dedup) ──────────────────────────────────────────
create unique index if not exists user_roles_user_id_uidx on public.user_roles (user_id);
create unique index if not exists user_entitlements_user_entitlement_uidx
  on public.user_entitlements (user_id, entitlement);
create unique index if not exists pricing_plans_plan_key_uidx on public.pricing_plans (plan_key);
create unique index if not exists promo_codes_code_uidx on public.promo_codes (code);
create unique index if not exists property_scores_property_id_uidx on public.property_scores (property_id);

-- ── PHASE 7: Triggers (only if updated_at exists) ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','pricing_plans','promo_codes','properties',
    'maintenance_items','repairs','appliances','contractors','documents',
    'receipts','warranties','paint_colors','photos'
  ] loop
    if public.hw_table_exists(t) and public.hw_column_exists(t, 'updated_at') then
      execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
      execute format(
        'create trigger %I_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
        t, t
      );
    end if;
  end loop;
end $$;

-- ── PHASE 8: Identity functions (after schema) ──────────────────────────────
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
     and public.hw_column_exists('user_roles', 'user_id')
     and public.hw_column_exists('user_roles', 'role')
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

create or replace function public.ensure_founder_full_access(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_founder_user(p_user_id) then return; end if;

  if public.hw_table_exists('user_roles')
     and public.hw_column_exists('user_roles', 'user_id')
     and public.hw_column_exists('user_roles', 'role') then
    if public.hw_column_exists('user_roles', 'updated_at') then
      insert into public.user_roles (user_id, role)
      values (p_user_id, 'super_admin')
      on conflict (user_id) do update set role = 'super_admin', updated_at = now();
    else
      insert into public.user_roles (user_id, role)
      values (p_user_id, 'super_admin')
      on conflict (user_id) do update set role = 'super_admin';
    end if;
  end if;

  if public.hw_table_exists('user_entitlements')
     and public.hw_column_exists('user_entitlements', 'user_id')
     and public.hw_column_exists('user_entitlements', 'entitlement') then
    insert into public.user_entitlements (user_id, entitlement, granted_by)
    select p_user_id, e.entitlement, p_user_id
    from (values
      ('owner_access'), ('premium'), ('landlord'), ('realtor')
    ) as e(entitlement)
    on conflict (user_id, entitlement) do nothing;
  end if;

  if public.hw_table_exists('profiles')
     and public.hw_column_exists('profiles', 'plan')
     and public.hw_column_exists('profiles', 'id') then
    if public.hw_column_exists('profiles', 'updated_at') then
      update public.profiles set plan = 'realtor', updated_at = now()
      where id = p_user_id and coalesce(plan, 'free') = 'free';
    else
      update public.profiles set plan = 'realtor'
      where id = p_user_id and coalesce(plan, 'free') = 'free';
    end if;
  end if;
end;
$$;

grant execute on function public.ensure_founder_full_access(uuid) to authenticated;

create or replace function public.bootstrap_owner_admin()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select email into v_email from auth.users where id = v_uid;
  if not public.is_founder_email(v_email) then raise exception 'Not authorized'; end if;
  perform public.ensure_founder_full_access(v_uid);
end;
$$;

grant execute on function public.bootstrap_owner_admin() to authenticated;

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select email into v_email from auth.users where id = auth.uid();
  if public.is_founder_email(v_email) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- Promo RPCs (only when discount_type exists)
do $$
begin
  if not public.hw_column_exists('promo_codes', 'discount_type') then return; end if;

  execute $fn$
    create or replace function public.validate_promo_code(p_code text, p_plan_key text default 'premium')
    returns jsonb language plpgsql security definer set search_path = public stable as $b$
    declare v public.promo_codes%rowtype;
    begin
      if auth.uid() is null then
        return jsonb_build_object('valid', false, 'error', 'Please sign in.');
      end if;
      select * into v from public.promo_codes
      where upper(trim(code)) = upper(trim(p_code)) limit 1;
      if not found then
        return jsonb_build_object('valid', false, 'error', 'Promo code not found.');
      end if;
      return jsonb_build_object('valid', true, 'promo', jsonb_build_object(
        'id', v.id, 'code', v.code, 'discount_type', v.discount_type,
        'discount_value', v.discount_value, 'plan_scope', v.plan_scope,
        'is_active', v.is_active, 'expires_at', v.expires_at
      ));
    end; $b$;

    create or replace function public.redeem_promo_code(p_code text, p_plan_key text default 'premium')
    returns jsonb language plpgsql security definer set search_path = public as $b$
    declare
      v_uid uuid := auth.uid();
      v public.promo_codes%rowtype;
      r jsonb;
    begin
      if v_uid is null then
        return jsonb_build_object('success', false, 'error', 'Please sign in.');
      end if;
      r := public.validate_promo_code(p_code, p_plan_key);
      if not (r->>'valid')::boolean then
        return jsonb_build_object('success', false, 'error', r->>'error');
      end if;
      select * into v from public.promo_codes
      where upper(trim(code)) = upper(trim(p_code)) limit 1;
      update public.promo_codes set used_count = used_count + 1 where id = v.id;
      return jsonb_build_object('success', true);
    end; $b$;
  $fn$;

  grant execute on function public.validate_promo_code(text, text) to authenticated;
  grant execute on function public.redeem_promo_code(text, text) to authenticated;
end $$;

-- Founder protection triggers
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
  if public.is_founder_email(old.email) and new.plan = 'free' then
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
     and old.role = 'super_admin' and new.role is distinct from 'super_admin' then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.ensure_founder_user_roles()
returns trigger language plpgsql as $$
begin
  if public.is_founder_user(new.user_id) and new.role is distinct from 'super_admin' then
    new.role := 'super_admin';
  end if;
  return new;
end;
$$;

create or replace function public.protect_founder_entitlements()
returns trigger language plpgsql as $$
begin
  if public.is_founder_user(old.user_id) then
    raise exception 'This account is protected and cannot be modified.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_founder_profile_delete on public.profiles;
create trigger protect_founder_profile_delete
  before delete on public.profiles
  for each row execute function public.protect_founder_profile_delete();

drop trigger if exists protect_founder_profile_update on public.profiles;
create trigger protect_founder_profile_update
  before update on public.profiles
  for each row execute function public.protect_founder_profile_update();

drop trigger if exists protect_founder_user_roles on public.user_roles;
create trigger protect_founder_user_roles
  before update or delete on public.user_roles
  for each row execute function public.protect_founder_user_roles();

drop trigger if exists ensure_founder_user_roles on public.user_roles;
create trigger ensure_founder_user_roles
  before insert or update on public.user_roles
  for each row execute function public.ensure_founder_user_roles();

drop trigger if exists protect_founder_entitlements on public.user_entitlements;
create trigger protect_founder_entitlements
  before delete on public.user_entitlements
  for each row execute function public.protect_founder_entitlements();

-- Restore founder access for existing accounts
do $$
declare r record;
begin
  for r in select u.id from auth.users u where public.is_founder_email(u.email::text) loop
    perform public.ensure_founder_full_access(r.id);
  end loop;
end $$;

-- ── PHASE 9: RLS rebuild (after schema complete) ────────────────────────────
create or replace function public.hw_apply_user_rls(p_table text)
returns void language plpgsql as $$
declare op text;
  ops text[] := array['select','insert','update','delete'];
  pol text;
begin
  if not public.hw_table_exists(p_table) or not public.hw_column_exists(p_table, 'user_id') then
    return;
  end if;

  execute format('alter table public.%I enable row level security', p_table);

  -- Drop legacy bundled policies from 003/015/020
  execute format('drop policy if exists "Users manage own %I" on public.%I', p_table, p_table);

  foreach op in array ops loop
    pol := p_table || '_' || op || '_own';
    execute format('drop policy if exists %I on public.%I', pol, p_table);
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

do $$
declare t text;
begin
  foreach t in array array[
    'maintenance_items','repairs','appliances','contractors','documents',
    'receipts','warranties','paint_colors','properties','property_scores','photos'
  ] loop
    perform public.hw_apply_user_rls(t);
  end loop;
end $$;

-- profiles (uses id not user_id)
alter table public.profiles enable row level security;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles for all using (public.is_super_admin());

-- user_roles
alter table public.user_roles enable row level security;
drop policy if exists "Users read own role" on public.user_roles;
drop policy if exists "Admins manage roles" on public.user_roles;
drop policy if exists "user_roles_select_own" on public.user_roles;
drop policy if exists "user_roles_admin_all" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles for select using (auth.uid() = user_id);
create policy "user_roles_admin_all" on public.user_roles for all using (public.is_super_admin());

-- user_entitlements
alter table public.user_entitlements enable row level security;
drop policy if exists "Super admins manage entitlements" on public.user_entitlements;
drop policy if exists "Users read own entitlements" on public.user_entitlements;
drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
drop policy if exists "user_entitlements_admin_all" on public.user_entitlements;
create policy "user_entitlements_select_own" on public.user_entitlements for select using (auth.uid() = user_id);
create policy "user_entitlements_admin_all" on public.user_entitlements for all using (public.is_super_admin());

-- pricing_plans
alter table public.pricing_plans enable row level security;
drop policy if exists "Anyone reads active pricing" on public.pricing_plans;
drop policy if exists "Admins manage pricing" on public.pricing_plans;
drop policy if exists "pricing_plans_select_active" on public.pricing_plans;
drop policy if exists "pricing_plans_insert_admin" on public.pricing_plans;
drop policy if exists "pricing_plans_update_admin" on public.pricing_plans;
drop policy if exists "pricing_plans_delete_admin" on public.pricing_plans;
create policy "pricing_plans_select_active" on public.pricing_plans
  for select using (is_active = true or public.is_super_admin());
create policy "pricing_plans_insert_admin" on public.pricing_plans
  for insert with check (public.is_super_admin());
create policy "pricing_plans_update_admin" on public.pricing_plans
  for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy "pricing_plans_delete_admin" on public.pricing_plans
  for delete using (public.is_super_admin());

-- promo_codes
alter table public.promo_codes enable row level security;
drop policy if exists "Admins manage promo codes" on public.promo_codes;
drop policy if exists "promo_codes_select_admin" on public.promo_codes;
drop policy if exists "promo_codes_insert_admin" on public.promo_codes;
drop policy if exists "promo_codes_update_admin" on public.promo_codes;
drop policy if exists "promo_codes_delete_admin" on public.promo_codes;
create policy "promo_codes_select_admin" on public.promo_codes for select using (public.is_super_admin());
create policy "promo_codes_insert_admin" on public.promo_codes for insert with check (public.is_super_admin());
create policy "promo_codes_update_admin" on public.promo_codes for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy "promo_codes_delete_admin" on public.promo_codes for delete using (public.is_super_admin());

-- notification_broadcasts + reads
alter table public.notification_broadcasts enable row level security;
alter table public.user_broadcast_reads enable row level security;
drop policy if exists "Authenticated read active broadcasts" on public.notification_broadcasts;
drop policy if exists "Admins manage broadcasts" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_select_active" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_insert_admin" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_update_admin" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_delete_admin" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_select_admin" on public.notification_broadcasts;
drop policy if exists "Users manage own broadcast reads" on public.user_broadcast_reads;
drop policy if exists "user_broadcast_reads_all_own" on public.user_broadcast_reads;
create policy "notification_broadcasts_select_active" on public.notification_broadcasts
  for select using (auth.uid() is not null and is_active = true);
create policy "notification_broadcasts_select_admin" on public.notification_broadcasts
  for select using (public.is_super_admin());
create policy "notification_broadcasts_insert_admin" on public.notification_broadcasts
  for insert with check (public.is_super_admin());
create policy "notification_broadcasts_update_admin" on public.notification_broadcasts
  for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy "notification_broadcasts_delete_admin" on public.notification_broadcasts
  for delete using (public.is_super_admin());
create policy "user_broadcast_reads_all_own" on public.user_broadcast_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── PHASE 10: Seed pricing_plans (only when full schema exists) ───────────────
do $$
declare
  c text;
  required text[] := array[
    'plan_key','name','monthly_price','yearly_price',
    'description','features','is_active','sort_order'
  ];
  ready boolean := true;
begin
  if not public.hw_table_exists('pricing_plans') then return; end if;
  foreach c in array required loop
    if not public.hw_column_exists('pricing_plans', c) then
      ready := false;
      exit;
    end if;
  end loop;
  if not ready then return; end if;

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
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 11: VERIFICATION QUERIES (run manually after migration)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- -- 1. Critical columns exist
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (table_name, column_name) IN (
--     ('user_roles','updated_at'), ('user_roles','user_id'),
--     ('pricing_plans','name'), ('pricing_plans','plan_key'),
--     ('documents','upload_date'), ('promo_codes','discount_type'),
--     ('maintenance_items','user_id'), ('repairs','user_id'),
--     ('appliances','user_id'), ('contractors','user_id')
--   )
-- ORDER BY 1, 2;
--
-- -- 2. No duplicate user_roles or user_entitlements
-- SELECT user_id, count(*) FROM public.user_roles GROUP BY user_id HAVING count(*) > 1;
-- SELECT user_id, entitlement, count(*) FROM public.user_entitlements
-- GROUP BY user_id, entitlement HAVING count(*) > 1;
--
-- -- 3. INSERT policies on failing tables
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('maintenance_items','repairs','appliances','contractors','documents')
--   AND cmd = 'INSERT'
-- ORDER BY tablename;
--
-- -- 4. Founder roles and entitlements
-- SELECT u.email, ur.role, ue.entitlement
-- FROM auth.users u
-- LEFT JOIN public.user_roles ur ON ur.user_id = u.id
-- LEFT JOIN public.user_entitlements ue ON ue.user_id = u.id
-- WHERE lower(u.email) IN ('horse0140@gmail.com','hdmccoy180@gmail.com');
--
-- -- 5. pricing_plans seeded
-- SELECT plan_key, name, sort_order FROM public.pricing_plans ORDER BY sort_order;
--
-- -- 6. Unique indexes
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname IN (
--     'user_roles_user_id_uidx','user_entitlements_user_entitlement_uidx',
--     'pricing_plans_plan_key_uidx','promo_codes_code_uidx'
--   );
--
-- -- 7. Functions present
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND proname IN ('is_super_admin','ensure_founder_full_access','validate_promo_code','delete_own_account');
--
-- ═══════════════════════════════════════════════════════════════════════════
