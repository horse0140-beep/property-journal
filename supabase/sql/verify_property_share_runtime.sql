-- ============================================================================
-- verify_property_share_runtime.sql
-- READ-ONLY — does not modify data.
-- Run in Supabase SQL editor. Optionally set:
--   select set_config('app.verify_share_token', 'HW-XXXXXXXX', true);
-- before running to check one masked token row.
-- ============================================================================

with cfg as (
  select nullif(current_setting('app.verify_share_token', true), '') as token
),
rpc as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    p.prosecdef as security_definer,
    pg_get_function_result(p.oid) as result_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_share_by_token'
),
rls as (
  select c.relrowsecurity as enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'property_shares'
),
policies as (
  select policyname, cmd, roles::text as roles, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = 'property_shares'
),
token_row as (
  select
    s.id,
    left(s.share_token, 4) || '…' || right(s.share_token, 3) as token_masked,
    length(s.share_token) as token_len,
    s.is_active,
    s.expires_at,
    s.property_id,
    s.user_id,
    (s.expires_at is not null and s.expires_at < now()) as is_expired,
    exists (
      select 1 from public.properties p where p.id = s.property_id
    ) as property_exists
  from public.property_shares s
  cross join cfg
  where cfg.token is not null
    and s.share_token = trim(cfg.token)
  limit 1
)

-- 1) RPC exists
select 'get_share_by_token exists' as check_name,
  case when exists (select 1 from rpc) then 'PASS' else 'FAIL' end as result,
  (select args from rpc limit 1) as detail

union all

-- 2) RPC signature
select 'get_share_by_token signature',
  case
    when exists (select 1 from rpc where args = 'p_token text' and result_type ilike '%jsonb%')
      then 'PASS'
    else 'FAIL'
  end,
  (select format('args=%s result=%s security_definer=%s', args, result_type, security_definer) from rpc limit 1)

union all

-- 3) EXECUTE for anon
select 'get_share_by_token EXECUTE anon',
  case when has_function_privilege('anon', 'public.get_share_by_token(text)', 'EXECUTE')
    then 'PASS' else 'FAIL' end,
  null

union all

-- 4) EXECUTE for authenticated
select 'get_share_by_token EXECUTE authenticated',
  case when has_function_privilege('authenticated', 'public.get_share_by_token(text)', 'EXECUTE')
    then 'PASS' else 'FAIL' end,
  null

union all

-- 5) RLS enabled
select 'property_shares RLS enabled',
  case when exists (select 1 from rls where enabled) then 'PASS' else 'FAIL' end,
  null

union all

-- 6) No public enumeration SELECT (using true / open qual for anon)
select 'no public enumeration SELECT',
  case when exists (
    select 1 from policies
    where cmd = 'SELECT'
      and (
        roles ilike '%anon%'
        or roles ilike '%public%'
        or roles = '{public}'
      )
      and (qual is null or qual in ('true', '(true)'))
  ) then 'FAIL' else 'PASS' end,
  (select string_agg(policyname || ':' || cmd, ', ') from policies)

union all

-- 7) Owner manage policy
select 'owner manage policy exists',
  case when exists (
    select 1 from policies
    where policyname ilike '%own%' or policyname ilike '%manage%'
  ) then 'PASS' else 'FAIL' end,
  (select string_agg(distinct policyname, ', ') from policies)

union all

-- 8–12) Optional selected token checks
select 'selected token row exists',
  case
    when (select token from cfg) is null then 'SKIP (set app.verify_share_token)'
    when exists (select 1 from token_row) then 'PASS'
    else 'FAIL'
  end,
  (select token_masked from token_row)

union all

select 'selected token active',
  case
    when (select token from cfg) is null then 'SKIP'
    when exists (select 1 from token_row where is_active) then 'PASS'
    when exists (select 1 from token_row) then 'FAIL'
    else 'FAIL'
  end,
  (select format('is_active=%s', is_active) from token_row)

union all

select 'selected token not expired',
  case
    when (select token from cfg) is null then 'SKIP'
    when exists (select 1 from token_row where not is_expired) then 'PASS'
    when exists (select 1 from token_row) then 'FAIL'
    else 'FAIL'
  end,
  (select format('expires_at=%s', expires_at) from token_row)

union all

select 'selected property exists',
  case
    when (select token from cfg) is null then 'SKIP'
    when exists (select 1 from token_row where property_exists) then 'PASS'
    when exists (select 1 from token_row) then 'FAIL'
    else 'FAIL'
  end,
  (select format('property_id=%s', property_id) from token_row);
