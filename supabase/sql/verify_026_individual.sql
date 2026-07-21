-- ============================================================================
-- HomeWise 026 individual verification — READ ONLY
-- Run after: supabase/migrations/026_rc_security_fixes.sql
--
-- Each check is its own SELECT so a failure in one does not stop the rest.
-- Run the entire file in the Supabase SQL Editor; inspect every result set.
-- Expected: every result set shows result = 'PASS'.
--
-- Do not modify any database objects.
-- ============================================================================

-- ── 1. get_share_by_token RPC ────────────────────────────────────────────────
SELECT
  'get_share_by_token RPC' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_share_by_token'
        AND pg_get_function_identity_arguments(p.oid) = 'p_token text'
        AND pg_get_function_result(p.oid) = 'jsonb'
        AND p.prosecdef IS TRUE
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- ── 2. protect_profile_plan trigger ──────────────────────────────────────────
SELECT
  'protect_profile_plan trigger' AS check_name,
  CASE
    WHEN EXISTS (
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
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- ── 3. protect_profile_plan function ─────────────────────────────────────────
SELECT
  'protect_profile_plan function' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'protect_profile_plan'
        AND pg_get_function_result(p.oid) = 'trigger'
        AND p.prosecdef IS TRUE
        AND p.prosrc ILIKE '%homewise.allow_plan_change%'
        AND p.prosrc ILIKE '%is_super_admin%'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- ── 4. validate_promo_code ───────────────────────────────────────────────────
SELECT
  'validate_promo_code' AS check_name,
  CASE
    WHEN EXISTS (
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
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- ── 5. redeem_promo_code ─────────────────────────────────────────────────────
SELECT
  'redeem_promo_code' AS check_name,
  CASE
    WHEN EXISTS (
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
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- ── 6. before-after-photos bucket ────────────────────────────────────────────
SELECT
  'before-after-photos bucket' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM storage.buckets
      WHERE id = 'before-after-photos'
        AND name = 'before-after-photos'
        AND public IS FALSE
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- ── 7. storage policies (before-after-photos) ────────────────────────────────
SELECT
  'before-after-photos storage policies' AS check_name,
  CASE
    WHEN (
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
    ) = 4 THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- Detail: which of the 4 policies are present / missing (informational)
SELECT
  required.policyname,
  CASE WHEN p.policyname IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM (
  SELECT unnest(ARRAY[
    'Users upload own before-after-photos',
    'Users read own before-after-photos',
    'Users update own before-after-photos',
    'Users delete own before-after-photos'
  ]::text[]) AS policyname
) required
LEFT JOIN pg_policies p
  ON p.schemaname = 'storage'
 AND p.tablename = 'objects'
 AND p.policyname = required.policyname
ORDER BY required.policyname;

-- ── 8. RLS status ────────────────────────────────────────────────────────────
SELECT
  'RLS on property_shares' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'property_shares'
        AND c.relrowsecurity IS TRUE
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

SELECT
  'RLS on profiles' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles'
        AND c.relrowsecurity IS TRUE
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

SELECT
  'RLS on promo_codes' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'promo_codes'
        AND c.relrowsecurity IS TRUE
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- ── 9. property_shares policies ──────────────────────────────────────────────
-- Public SELECT policy must be gone
SELECT
  'property_shares public SELECT policy removed' AS check_name,
  CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'property_shares'
        AND policyname = 'Public read active shares by token'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- Owner manage policy should still exist (expected after earlier migrations)
SELECT
  'property_shares owner manage policy exists' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'property_shares'
        AND (
          policyname = 'Users manage own property shares'
          OR policyname ILIKE '%own%share%'
          OR (cmd = 'ALL' AND roles::text ILIKE '%authenticated%')
        )
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- Detail: list all current property_shares policies (informational)
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'property_shares'
ORDER BY policyname;
