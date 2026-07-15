-- Founder account protection + admin audit log
-- Founder: horse0140@gmail.com — immutable super_admin + owner_access

-- ── founder helpers ─────────────────────────────────────────────
create or replace function public.founder_email()
returns text
language sql
immutable
as $$
  select 'horse0140@gmail.com';
$$;

create or replace function public.is_founder_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) = public.founder_email();
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

-- ── admin_actions audit log ─────────────────────────────────────
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

-- ── ensure founder bootstrap on sign-in ───────────────────────────
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

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'super_admin')
  on conflict (user_id) do update set role = 'super_admin', updated_at = now();

  insert into public.user_entitlements (user_id, entitlement, granted_by)
  values (v_user_id, 'owner_access', v_user_id)
  on conflict (user_id, entitlement) do nothing;

  insert into public.user_entitlements (user_id, entitlement, granted_by)
  select v_user_id, e.entitlement, v_user_id
  from (values ('premium'), ('landlord'), ('realtor')) as e(entitlement)
  on conflict (user_id, entitlement) do nothing;

  update public.profiles
  set plan = 'realtor', updated_at = now()
  where id = v_user_id;
end;
$$;

grant execute on function public.bootstrap_owner_admin() to authenticated;

-- ── block founder self-deletion via auth RPC ────────────────────
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

-- ── triggers: founder profile / role / entitlement protection ─
create or replace function public.protect_founder_profile_delete()
returns trigger
language plpgsql
as $$
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
returns trigger
language plpgsql
as $$
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

create or replace function public.protect_founder_entitlements()
returns trigger
language plpgsql
as $$
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

-- Re-assert founder access if row somehow downgraded (belt + suspenders)
create or replace function public.ensure_founder_user_roles()
returns trigger
language plpgsql
as $$
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

-- Prevent founder plan downgrade
create or replace function public.protect_founder_profile_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_founder_email(old.email) then
    if new.plan is distinct from old.plan and new.plan <> 'realtor' then
      new.plan := 'realtor';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_founder_profile_update on public.profiles;
create trigger protect_founder_profile_update
  before update on public.profiles
  for each row execute function public.protect_founder_profile_update();

-- Auto-ensure founder owner_access entitlement exists
create or replace function public.ensure_founder_owner_entitlement()
returns trigger
language plpgsql
as $$
begin
  if public.is_founder_user(new.user_id) then
    insert into public.user_entitlements (user_id, entitlement, granted_by)
    values (new.user_id, 'owner_access', new.user_id)
    on conflict (user_id, entitlement) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_founder_owner_entitlement on public.user_roles;
create trigger ensure_founder_owner_entitlement
  after insert or update on public.user_roles
  for each row execute function public.ensure_founder_owner_entitlement();
