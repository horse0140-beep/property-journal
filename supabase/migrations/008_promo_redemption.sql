-- Extend promo code types and add secure redemption RPCs
-- Run after 007_user_entitlements.sql

-- Allow lifetime_access and owner_grant discount types
alter table public.promo_codes drop constraint if exists promo_codes_discount_type_check;
alter table public.promo_codes add constraint promo_codes_discount_type_check
  check (discount_type in ('percent', 'fixed', 'free_trial', 'lifetime_access', 'owner_grant'));

-- Users can read their own entitlements
drop policy if exists "Users read own entitlements" on public.user_entitlements;
create policy "Users read own entitlements" on public.user_entitlements
  for select using (auth.uid() = user_id);

-- Validate promo without redeeming (preview discount)
create or replace function public.validate_promo_code(
  p_code text,
  p_plan_key text default 'premium'
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_promo public.promo_codes%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('valid', false, 'error', 'Please sign in to use a promo code.');
  end if;

  select * into v_promo
  from public.promo_codes
  where upper(trim(code)) = upper(trim(p_code))
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'error', 'Promo code not found.');
  end if;

  if not v_promo.is_active then
    return jsonb_build_object('valid', false, 'error', 'This promo code is no longer active.');
  end if;

  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    return jsonb_build_object('valid', false, 'error', 'This promo code has expired.');
  end if;

  if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object('valid', false, 'error', 'This promo code has reached its usage limit.');
  end if;

  if v_promo.plan_scope <> 'all' and v_promo.plan_scope <> p_plan_key then
    return jsonb_build_object(
      'valid', false,
      'error', 'This code does not apply to the ' || p_plan_key || ' plan.'
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'promo', jsonb_build_object(
      'id', v_promo.id,
      'code', v_promo.code,
      'description', v_promo.description,
      'discount_type', v_promo.discount_type,
      'discount_value', v_promo.discount_value,
      'plan_scope', v_promo.plan_scope,
      'max_uses', v_promo.max_uses,
      'used_count', v_promo.used_count,
      'is_active', v_promo.is_active,
      'expires_at', v_promo.expires_at
    )
  );
end;
$$;

-- Redeem promo: increment usage, grant access when applicable
create or replace function public.redeem_promo_code(
  p_code text,
  p_plan_key text default 'premium'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_promo public.promo_codes%rowtype;
  v_grant_plan text;
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Please sign in to redeem a promo code.');
  end if;

  v_result := public.validate_promo_code(p_code, p_plan_key);
  if not (v_result->>'valid')::boolean then
    return jsonb_build_object('success', false, 'error', v_result->>'error');
  end if;

  select * into v_promo
  from public.promo_codes
  where upper(trim(code)) = upper(trim(p_code))
  limit 1;

  v_grant_plan := case
    when v_promo.plan_scope = 'all' then p_plan_key
    else v_promo.plan_scope
  end;

  case v_promo.discount_type
    when 'lifetime_access' then
      update public.profiles set plan = v_grant_plan::text, updated_at = now()
      where id = v_user_id;
      if v_grant_plan in ('premium', 'landlord', 'realtor') then
        insert into public.user_entitlements (user_id, entitlement, granted_by)
        values (v_user_id, v_grant_plan, v_user_id)
        on conflict (user_id, entitlement) do nothing;
      end if;

    when 'free_trial' then
      update public.profiles set plan = v_grant_plan::text, updated_at = now()
      where id = v_user_id;
      if v_grant_plan in ('premium', 'landlord', 'realtor') then
        insert into public.user_entitlements (user_id, entitlement, granted_by)
        values (v_user_id, v_grant_plan, v_user_id)
        on conflict (user_id, entitlement) do nothing;
      end if;

    when 'owner_grant' then
      insert into public.user_roles (user_id, role)
      values (v_user_id, 'super_admin')
      on conflict (user_id) do update set role = 'super_admin', updated_at = now();
      insert into public.user_entitlements (user_id, entitlement, granted_by)
      values (v_user_id, 'owner_access', v_user_id)
      on conflict (user_id, entitlement) do nothing;
      update public.profiles set plan = 'realtor', updated_at = now()
      where id = v_user_id;
      v_grant_plan := 'realtor';

    else
      -- percent / fixed: price discount only; no plan change
      v_grant_plan := null;
  end case;

  update public.promo_codes
  set used_count = used_count + 1, updated_at = now()
  where id = v_promo.id;

  return jsonb_build_object(
    'success', true,
    'message', case v_promo.discount_type
      when 'percent' then v_promo.discount_value || '% discount applied!'
      when 'fixed' then '$' || v_promo.discount_value || ' discount applied!'
      when 'free_trial' then 'Free trial activated for ' || v_grant_plan || '!'
      when 'lifetime_access' then 'Lifetime ' || v_grant_plan || ' access granted!'
      when 'owner_grant' then 'Owner access granted!'
      else 'Promo code applied!'
    end,
    'promo', jsonb_build_object(
      'id', v_promo.id,
      'code', v_promo.code,
      'discount_type', v_promo.discount_type,
      'discount_value', v_promo.discount_value,
      'plan_scope', v_promo.plan_scope
    ),
    'granted_plan', v_grant_plan
  );
end;
$$;

grant execute on function public.validate_promo_code(text, text) to authenticated;
grant execute on function public.redeem_promo_code(text, text) to authenticated;
