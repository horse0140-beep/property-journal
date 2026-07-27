-- Verify migration 030: share content permissions RPC
-- Run after applying 030_share_content_permissions.sql

select 'get_share_by_token exists' as check_name,
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_share_by_token'
  ) then 'PASS' else 'FAIL' end as result;

select 'get_share_by_token security definer' as check_name,
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_share_by_token'
      and p.prosecdef = true
  ) then 'PASS' else 'FAIL' end as result;

select 'get_share_by_token EXECUTE anon' as check_name,
  case when has_function_privilege('anon', 'public.get_share_by_token(text)', 'EXECUTE')
    then 'PASS' else 'FAIL' end as result;

select 'get_share_by_token EXECUTE authenticated' as check_name,
  case when has_function_privilege('authenticated', 'public.get_share_by_token(text)', 'EXECUTE')
    then 'PASS' else 'FAIL' end as result;

select 'snapshot_json column exists' as check_name,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'property_shares'
      and column_name = 'snapshot_json'
      and data_type = 'jsonb'
  ) then 'PASS' else 'FAIL' end as result;

-- Invalid: inactive/unknown token returns null
select 'unknown token returns null' as check_name,
  case when public.get_share_by_token('HW-VERIFY-INVALID-TOKEN-XXXX') is null
    then 'PASS' else 'FAIL' end as result;

-- Optional: if a test share exists with permissions.sections.repairCosts=false,
-- confirm cost keys are null in recentRepairs. Skip when no rows.
do $$
declare
  v_token text;
  v_result jsonb;
  v_costs jsonb;
begin
  select share_token into v_token
  from public.property_shares
  where is_active = true
    and snapshot_json->'permissions'->'sections'->>'repairCosts' = 'false'
    and jsonb_array_length(coalesce(snapshot_json->'recentRepairs', '[]'::jsonb)) > 0
  limit 1;

  if v_token is null then
    raise notice 'SKIP cost-sanitization sample (no matching share)';
    return;
  end if;

  v_result := public.get_share_by_token(v_token);
  select jsonb_agg(elem->'cost')
  into v_costs
  from jsonb_array_elements(coalesce(v_result->'snapshot_json'->'recentRepairs', '[]'::jsonb)) elem;

  if v_costs is not null and v_costs @> '[]'::jsonb then
    null; -- ok
  end if;

  -- All costs should be null when repairCosts is false
  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_result->'snapshot_json'->'recentRepairs', '[]'::jsonb)) elem
    where elem->>'cost' is not null and elem->>'cost' <> ''
  ) then
    raise exception 'FAIL: repair costs leaked when repairCosts=false';
  end if;

  raise notice 'PASS cost-sanitization sample for token %', left(v_token, 8);
end $$;
