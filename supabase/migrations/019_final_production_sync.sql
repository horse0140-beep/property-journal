-- HomeWise final production schema sync (idempotent)
-- Run after 000–018. Aligns live Supabase with application code.

-- ── helpers ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Protected founder emails (permanent owner + super_admin)
create or replace function public.founder_emails()
returns text[]
language sql
immutable
as $$
  select array['horse0140@gmail.com', 'hdmccoy180@gmail.com']::text[];
$$;

create or replace function public.is_founder_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) = any (
    select lower(e) from unnest(public.founder_emails()) as e
  );
$$;

create or replace function public.is_founder_user(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and public.is_founder_email(u.email::text)
  );
$$;

-- Super admin = role OR protected founder email
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  )
  or exists (
    select 1 from auth.users u
    where u.id = auth.uid() and public.is_founder_email(u.email::text)
  );
$$;

-- ── ensure founder full access ────────────────────────────────
create or replace function public.ensure_founder_full_access(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder_user(p_user_id) then
    return;
  end if;

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'super_admin')
  on conflict (user_id) do update set role = 'super_admin', updated_at = now();

  insert into public.user_entitlements (user_id, entitlement, granted_by)
  select p_user_id, e.entitlement, p_user_id
  from (
    values
      ('owner_access'),
      ('premium'),
      ('landlord'),
      ('realtor')
  ) as e(entitlement)
  on conflict (user_id, entitlement) do nothing;

  update public.profiles
  set plan = 'realtor', updated_at = now()
  where id = p_user_id and plan = 'free';
end;
$$;

grant execute on function public.ensure_founder_full_access(uuid) to authenticated;

create or replace function public.bootstrap_owner_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  if not public.is_founder_email(v_email) then
    raise exception 'Not authorized';
  end if;

  perform public.ensure_founder_full_access(v_user_id);
end;
$$;

grant execute on function public.bootstrap_owner_admin() to authenticated;

-- ── pricing_plans ─────────────────────────────────────────────
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

alter table public.pricing_plans enable row level security;

drop policy if exists "Anyone reads active pricing" on public.pricing_plans;
create policy "Anyone reads active pricing" on public.pricing_plans
  for select using (is_active = true or public.is_super_admin());

drop policy if exists "Admins manage pricing" on public.pricing_plans;
create policy "Admins manage pricing" on public.pricing_plans
  for all using (public.is_super_admin());

-- ── notification_broadcasts ───────────────────────────────────
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

-- ── admin_actions audit ─────────────────────────────────────────
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_user_idx on public.admin_actions (target_user_id);

alter table public.admin_actions enable row level security;

drop policy if exists "Super admins read admin_actions" on public.admin_actions;
create policy "Super admins read admin_actions" on public.admin_actions
  for select using (public.is_super_admin());

drop policy if exists "Super admins insert admin_actions" on public.admin_actions;
create policy "Super admins insert admin_actions" on public.admin_actions
  for insert with check (public.is_super_admin());

-- ── columns ─────────────────────────────────────────────────────
alter table public.documents add column if not exists tags text[] default '{}';
alter table public.receipts add column if not exists tags text[] default '{}';
alter table public.warranties add column if not exists tags text[] default '{}';

alter table public.user_entitlements
  add column if not exists granted_by uuid references auth.users(id) on delete set null;

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

-- ── ON CONFLICT unique indexes ──────────────────────────────────
create unique index if not exists user_roles_user_id_uidx on public.user_roles (user_id);
create unique index if not exists user_entitlements_user_entitlement_uidx
  on public.user_entitlements (user_id, entitlement);
create unique index if not exists push_tokens_user_token_uidx on public.push_tokens (user_id, token);
create unique index if not exists property_scores_property_id_uidx on public.property_scores (property_id);
create unique index if not exists stripe_customers_user_id_uidx on public.stripe_customers (user_id);
create unique index if not exists maintenance_forecasts_user_property_uidx
  on public.maintenance_forecasts (user_id, property_id);
create unique index if not exists promo_codes_code_uidx on public.promo_codes (code);

-- ── user-owned CRUD RLS ─────────────────────────────────────────
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
    'properties',
    'reports',
    'property_shares',
    'contractor_portal_access',
    'maintenance_forecasts'
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

-- ── founder protection triggers ───────────────────────────────
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  if public.is_founder_email(v_email) then
    raise exception 'This account is protected and cannot be modified.';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

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

create or replace function public.protect_founder_user_roles()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if public.is_founder_user(old.user_id) then
      raise exception 'This account is protected and cannot be modified.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if public.is_founder_user(old.user_id) and old.role = 'super_admin' and new.role is distinct from 'super_admin' then
      raise exception 'This account is protected and cannot be modified.';
    end if;
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
  if public.is_founder_email(old.email) then
    if new.plan = 'free' then
      raise exception 'This account is protected and cannot be modified.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_founder_profile_update on public.profiles;
create trigger protect_founder_profile_update
  before update on public.profiles
  for each row execute function public.protect_founder_profile_update();

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

create or replace function public.ensure_founder_after_role_change()
returns trigger language plpgsql as $$
begin
  if public.is_founder_user(new.user_id) then
    perform public.ensure_founder_full_access(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_founder_after_role_change on public.user_roles;
create trigger ensure_founder_after_role_change
  after insert or update on public.user_roles
  for each row execute function public.ensure_founder_after_role_change();

-- Restore access for existing founder accounts
do $$
declare
  r record;
begin
  for r in
    select u.id
    from auth.users u
    where public.is_founder_email(u.email::text)
  loop
    perform public.ensure_founder_full_access(r.id);
  end loop;
end $$;
