-- Founder full access: horse0140@gmail.com
-- Permanent super_admin, owner_access, premium, landlord, realtor + realtor plan

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
  where id = p_user_id
    and plan = 'free';
end;
$$;

grant execute on function public.ensure_founder_full_access(uuid) to authenticated;

-- Bootstrap on founder sign-in
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

-- Block removal of ANY founder entitlement
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

-- Force realtor plan; block downgrade to free
create or replace function public.protect_founder_profile_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_founder_email(old.email) then
    if new.plan = 'free' then
      raise exception 'This account is protected and cannot be modified.';
    end if;
    if new.plan is distinct from old.plan and new.plan not in ('premium', 'landlord', 'realtor') then
      new.plan := 'realtor';
    end if;
  end if;
  return new;
end;
$$;

-- Restore full access after profile insert (new founder sign-up)
create or replace function public.ensure_founder_on_profile_insert()
returns trigger
language plpgsql
as $$
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

-- Replace role-only entitlement trigger with full access restore
drop trigger if exists ensure_founder_owner_entitlement on public.user_roles;

create or replace function public.ensure_founder_after_role_change()
returns trigger
language plpgsql
as $$
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
