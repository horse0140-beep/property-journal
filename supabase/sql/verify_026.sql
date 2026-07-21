-- ============================================================================
-- HomeWise 026 verification — READ ONLY
-- Run after: supabase/migrations/026_rc_security_fixes.sql
--
-- Paste this entire file into the Supabase SQL Editor and execute.
-- Do not modify any database objects.
--
-- Expected: every row in the scorecard shows result = 'PASS'.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- SCORECARD — one PASS / FAIL row per verification
-- ═══════════════════════════════════════════════════════════════════════════
WITH checks AS (

  -- 1. get_share_by_token RPC exists (SECURITY DEFINER, returns jsonb)
  SELECT
    1 AS sort_order,
    'get_share_by_token RPC exists' AS check_name,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_share_by_token'
        AND pg_get_function_identity_arguments(p.oid) = 'p_token text'
        AND pg_get_function_result(p.oid) = 'jsonb'
        AND p.prosecdef IS TRUE
    ) AS ok

  UNION ALL

  -- 2. property_shares no longer has the public SELECT policy
  SELECT
    2,
    'property_shares public SELECT policy removed',
    NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'property_shares'
        AND policyname = 'Public read active shares by token'
    )

  UNION ALL

  -- 3. protect_profile_plan trigger exists on profiles (BEFORE UPDATE)
  SELECT
    3,
    'protect_profile_plan trigger exists',
    EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles'
        AND t.tgname = 'protect_profile_plan_trigger'
        AND NOT t.tgisinternal
        AND p.proname = 'protect_profile_plan'
        AND (t.tgtype & 2) = 2    -- BEFORE
        AND (t.tgtype & 16) = 16  -- UPDATE
    )

  UNION ALL

  -- 4. profile plan trigger function exists
  SELECT
    4,
    'protect_profile_plan function exists',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'protect_profile_plan'
        AND pg_get_function_result(p.oid) = 'trigger'
        AND p.prosecdef IS TRUE
        AND p.prosrc ILIKE '%homewise.allow_plan_change%'
        AND p.prosrc ILIKE '%is_super_admin%'
    )

  UNION ALL

  -- 5. validate_promo_code function exists (full body, not 021 stub)
  SELECT
    5,
    'validate_promo_code function exists',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'validate_promo_code'
        AND pg_get_function_identity_arguments(p.oid) = 'p_code text, p_plan_key text'
        AND pg_get_function_result(p.oid) = 'jsonb'
        AND p.prosecdef IS TRUE
        AND p.prosrc ILIKE '%is_active%'
        AND p.prosrc ILIKE '%expires_at%'
        AND p.prosrc ILIKE '%max_uses%'
        AND p.prosrc ILIKE '%plan_scope%'
    )

  UNION ALL

  -- 6. redeem_promo_code function exists (grants plans + allow_plan_change)
  SELECT
    6,
    'redeem_promo_code function exists',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'redeem_promo_code'
        AND pg_get_function_identity_arguments(p.oid) = 'p_code text, p_plan_key text'
        AND pg_get_function_result(p.oid) = 'jsonb'
        AND p.prosecdef IS TRUE
        AND p.prosrc ILIKE '%homewise.allow_plan_change%'
        AND p.prosrc ILIKE '%lifetime_access%'
        AND p.prosrc ILIKE '%owner_grant%'
        AND p.prosrc ILIKE '%used_count%'
    )

  UNION ALL

  -- 7. before-after-photos bucket exists (private)
  SELECT
    7,
    'before-after-photos bucket exists',
    EXISTS (
      SELECT 1
      FROM storage.buckets
      WHERE id = 'before-after-photos'
        AND name = 'before-after-photos'
        AND public IS FALSE
    )

  UNION ALL

  -- 8. storage policies exist for before-after-photos (all 4)
  SELECT
    8,
    'before-after-photos storage policies exist',
    (
      SELECT count(*)
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname IN (
          'Users upload own before-after-photos',
          'Users read own before-after-photos',
          'Users update own before-after-photos',
          'Users delete own before-after-photos'
        )
    ) = 4

  UNION ALL

  -- 9a. RLS enabled on property_shares
  SELECT
    9,
    'RLS enabled on property_shares',
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'property_shares'
        AND c.relrowsecurity IS TRUE
    )

  UNION ALL

  -- 9b. RLS enabled on profiles
  SELECT
    10,
    'RLS enabled on profiles',
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles'
        AND c.relrowsecurity IS TRUE
    )

  UNION ALL

  -- 9c. RLS enabled on promo_codes
  SELECT
    11,
    'RLS enabled on promo_codes',
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'promo_codes'
        AND c.relrowsecurity IS TRUE
    )

  UNION ALL

  -- 9d. get_share_by_token EXECUTE granted to anon + authenticated
  SELECT
    12,
    'get_share_by_token granted to anon + authenticated',
    has_function_privilege('anon', 'public.get_share_by_token(text)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.get_share_by_token(text)', 'EXECUTE')

  UNION ALL

  -- 9e. promo RPCs EXECUTE granted to authenticated
  SELECT
    13,
    'promo RPCs granted to authenticated',
    has_function_privilege('authenticated', 'public.validate_promo_code(text, text)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.redeem_promo_code(text, text)', 'EXECUTE')
)
SELECT
  check_name,
  CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks
ORDER BY sort_order;

-- ═══════════════════════════════════════════════════════════════════════════
-- DETAIL (informational — not required for the scorecard)
-- ═══════════════════════════════════════════════════════════════════════════

-- property_shares policies currently present
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'property_shares'
ORDER BY policyname;

-- get_share_by_token
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_share_by_token';

-- protect_profile_plan trigger
SELECT t.tgname, c.relname AS table_name, p.proname AS function_name, t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND t.tgname = 'protect_profile_plan_trigger'
  AND NOT t.tgisinternal;

-- promo functions
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('validate_promo_code', 'redeem_promo_code', 'protect_profile_plan')
ORDER BY p.proname;

-- before-after-photos bucket
SELECT id, name, public
FROM storage.buckets
WHERE id = 'before-after-photos';

-- before-after-photos storage policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%before-after-photos%'
ORDER BY policyname;

-- Missing storage policies (should return 0 rows)
WITH required AS (
  SELECT unnest(ARRAY[
    'Users upload own before-after-photos',
    'Users read own before-after-photos',
    'Users update own before-after-photos',
    'Users delete own before-after-photos'
  ]::text[]) AS policyname
)
SELECT r.policyname AS missing_policy
FROM required r
LEFT JOIN pg_policies p
  ON p.schemaname = 'storage'
 AND p.tablename = 'objects'
 AND p.policyname = r.policyname
WHERE p.policyname IS NULL
ORDER BY r.policyname;
