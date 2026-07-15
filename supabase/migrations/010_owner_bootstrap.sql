-- Owner bootstrap: allows the app owner email to self-grant super_admin via RPC.
-- Client-side upsert to user_roles is blocked by RLS for non-admins.

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

  if lower(trim(v_email)) <> 'horse0140@gmail.com' then
    raise exception 'Not authorized';
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'super_admin')
  on conflict (user_id) do update set role = 'super_admin';

  insert into public.user_entitlements (user_id, entitlement, granted_by)
  values (v_user_id, 'owner_access', v_user_id)
  on conflict (user_id, entitlement) do nothing;
end;
$$;

grant execute on function public.bootstrap_owner_admin() to authenticated;
