-- ============================================================================
-- 026 — Release Candidate security fixes
--
-- 1. property_shares: stop public enumeration of all active share rows.
--    Replaces the token-less public SELECT policy with a security definer
--    RPC that returns exactly one share for a known token (and increments
--    views_count server-side, which RLS previously blocked for viewers).
-- 2. profiles.plan: block self-service plan escalation. Premium gating reads
--    profiles.plan, and the *_update_own policy allowed any user to PATCH it.
--    A trigger now permits plan changes only for super admins or code paths
--    that explicitly opt in (the promo redemption RPC below).
-- 3. Promo RPCs: migration 021 replaced the full 020 implementations with
--    weak versions (no is_active/expiry/max_uses checks; redeem granted
--    nothing). Re-create the correct versions so the last definition wins.
-- 4. Storage: create policies for the before-after-photos bucket used by
--    repair before/after photo categories (no migration covered it).
-- ============================================================================

-- ── 1. property_shares public read → token RPC ───────────────────────────────
drop policy if exists "Public read active shares by token" on public.property_shares;

create or replace function public.get_share_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.property_shares%rowtype;
begin
  select * into v_share
  from public.property_shares
  where share_token = trim(p_token)
    and is_active = true
  limit 1;

  if not found then
    return null;
  end if;

  if v_share.expires_at is not null and v_share.expires_at < now() then
    return null;
  end if;

  update public.property_shares
  set views_count = coalesce(views_count, 0) + 1
  where id = v_share.id;

  v_share.views_count := coalesce(v_share.views_count, 0) + 1;
  return to_jsonb(v_share);
end;
$$;

grant execute on function public.get_share_by_token(text) to anon, authenticated;

-- ── 2. Block self-service plan escalation on profiles ────────────────────────
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan is distinct from old.plan then
    -- Server-side grant paths (promo redemption) set this transaction-local
    -- flag before updating the plan.
    if coalesce(current_setting('homewise.allow_plan_change', true), 'false') = 'true' then
      return new;
    end if;
    if public.is_super_admin() then
      return new;
    end if;
    raise exception 'Plan changes must be made by an administrator or a valid promo/purchase flow.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_plan_trigger on public.profiles;
create trigger protect_profile_plan_trigger
  before update on public.profiles
  for each row
  execute function public.protect_profile_plan();

-- ── 3. Restore the full promo RPCs (021 overwrote them with no-op versions) ──
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

  v_result := public.validate_promo_code(p_code, p_plan_key);
  if not (v_result->>'valid')::boolean then
    return jsonb_build_object('success', false, 'error', v_result->>'error');
  end if;
  select * into v_promo from public.promo_codes where upper(trim(code)) = upper(trim(p_code)) limit 1;
  v_grant_plan := case when v_promo.plan_scope = 'all' then p_plan_key else v_promo.plan_scope end;

  -- Authorize the plan change for the protect_profile_plan trigger.
  perform set_config('homewise.allow_plan_change', 'true', true);

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

-- ── 4. before-after-photos bucket policies ────────────────────────────────────
-- Create the bucket if the project allows it from SQL (ignore if not).
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('before-after-photos', 'before-after-photos', false)
  on conflict (id) do nothing;
exception when others then
  raise notice 'Could not create before-after-photos bucket from SQL — create it in the Dashboard.';
end $$;

do $$
declare b text := 'before-after-photos';
begin
  begin
    execute format($policy$
      create policy "Users upload own %1$s"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$, b);
  exception when duplicate_object then null;
  end;

  begin
    execute format($policy$
      create policy "Users read own %1$s"
      on storage.objects for select
      to authenticated
      using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$, b);
  exception when duplicate_object then null;
  end;

  begin
    execute format($policy$
      create policy "Users update own %1$s"
      on storage.objects for update
      to authenticated
      using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$, b);
  exception when duplicate_object then null;
  end;

  begin
    execute format($policy$
      create policy "Users delete own %1$s"
      on storage.objects for delete
      to authenticated
      using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$, b);
  exception when duplicate_object then null;
  end;
end $$;
