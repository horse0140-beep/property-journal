-- ═══════════════════════════════════════════════════════════════════════════
-- HomeWise — Maintenance & Repair save failure verification (READ-ONLY)
-- File: supabase/sql/verify_maintenance_repairs_failure.sql
--
-- SAFE: Sections 1–7 are SELECT-only. Section 8 is COMMENTED OUT (optional
-- diagnostic inserts). Do not uncomment section 8 on production unless you
-- intend to test writes (they ROLLBACK).
--
-- Run in: Supabase Dashboard → SQL Editor → paste entire file → Run
-- Paste back: every result tab / section output (or screenshots of each grid)
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: maintenance_items — columns, nullability, defaults
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '1_maintenance_items_columns' AS section,
  c.ordinal_position AS pos,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'maintenance_items'
ORDER BY c.ordinal_position;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: repairs — columns, nullability, defaults
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '2_repairs_columns' AS section,
  c.ordinal_position AS pos,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'repairs'
ORDER BY c.ordinal_position;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: CHECK constraints (maintenance_items + repairs)
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '3_check_constraints' AS section,
  n.nspname AS schema_name,
  c.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('maintenance_items', 'repairs')
  AND con.contype = 'c'
ORDER BY c.relname, con.conname;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Foreign keys (maintenance_items + repairs)
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '4_foreign_keys' AS section,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
  AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('maintenance_items', 'repairs')
ORDER BY tc.table_name, kcu.ordinal_position;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5: RLS enabled + policies (maintenance_items + repairs)
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '5_rls_enabled' AS section,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('maintenance_items', 'repairs')
ORDER BY c.relname;

SELECT
  '5_rls_policies' AS section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('maintenance_items', 'repairs')
ORDER BY tablename, policyname;

-- Expected per-operation policies (from migration 020/021):
WITH required AS (
  SELECT * FROM (VALUES
    ('maintenance_items', 'maintenance_items_select_own', 'SELECT'),
    ('maintenance_items', 'maintenance_items_insert_own', 'INSERT'),
    ('maintenance_items', 'maintenance_items_update_own', 'UPDATE'),
    ('maintenance_items', 'maintenance_items_delete_own', 'DELETE'),
    ('repairs', 'repairs_select_own', 'SELECT'),
    ('repairs', 'repairs_insert_own', 'INSERT'),
    ('repairs', 'repairs_update_own', 'UPDATE'),
    ('repairs', 'repairs_delete_own', 'DELETE')
  ) AS v(tablename, policyname, cmd)
)
SELECT
  '5_missing_rls_policies' AS section,
  r.tablename,
  r.policyname,
  r.cmd,
  CASE WHEN p.policyname IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM required r
LEFT JOIN pg_catalog.pg_policies p
  ON p.schemaname = 'public'
  AND p.tablename = r.tablename
  AND p.policyname = r.policyname
ORDER BY r.tablename, r.cmd;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6: horse0140@gmail.com — auth user id, profile, properties, FK match
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '6_founder_auth_user' AS section,
  u.id AS auth_user_id,
  u.email,
  u.created_at AS auth_created_at,
  p.id AS profile_id,
  CASE WHEN p.id = u.id THEN 'OK profiles.id = auth.users.id' ELSE 'MISMATCH' END AS profile_id_match
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(trim(u.email::text)) = 'horse0140@gmail.com';

SELECT
  '6_founder_properties' AS section,
  pr.id AS property_id,
  pr.user_id,
  pr.property_name,
  pr.address,
  pr.street_address,
  pr.is_selected,
  pr.created_at,
  CASE
    WHEN pr.user_id = u.id THEN 'OK property.user_id = auth.users.id'
    ELSE 'MISMATCH property.user_id'
  END AS user_id_match
FROM auth.users u
JOIN public.properties pr ON pr.user_id = u.id
WHERE lower(trim(u.email::text)) = 'horse0140@gmail.com'
ORDER BY pr.created_at DESC
LIMIT 10;

-- Orphan check: properties whose user_id is not an auth user
SELECT
  '6_orphan_properties' AS section,
  pr.id AS property_id,
  pr.user_id,
  pr.address
FROM public.properties pr
LEFT JOIN auth.users u ON u.id = pr.user_id
WHERE u.id IS NULL
ORDER BY pr.created_at DESC
LIMIT 20;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 7: Recent maintenance_items + repairs for horse0140@gmail.com
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '7_recent_maintenance_items' AS section,
  m.id,
  m.user_id,
  m.property_id,
  m.title,
  m.category,
  m.last_completed,
  m.next_due,
  m.status,
  m.priority,
  m.recurring,
  m.interval_days,
  m.notes,
  m.created_at,
  m.updated_at,
  CASE WHEN m.user_id = u.id THEN 'OK' ELSE 'user_id mismatch' END AS user_match,
  CASE WHEN p.id IS NOT NULL THEN 'OK property exists' ELSE 'MISSING property' END AS property_match
FROM auth.users u
JOIN public.maintenance_items m ON m.user_id = u.id
LEFT JOIN public.properties p ON p.id = m.property_id
WHERE lower(trim(u.email::text)) = 'horse0140@gmail.com'
ORDER BY m.created_at DESC
LIMIT 20;

SELECT
  '7_recent_repairs' AS section,
  r.id,
  r.user_id,
  r.property_id,
  r.title,
  r.date,
  r.cost,
  r.contractor,
  r.category,
  r.notes,
  r.photo_urls,
  r.receipt_url,
  r.warranty_expires,
  r.created_at,
  CASE WHEN r.user_id = u.id THEN 'OK' ELSE 'user_id mismatch' END AS user_match,
  CASE WHEN p.id IS NOT NULL THEN 'OK property exists' ELSE 'MISSING property' END AS property_match
FROM auth.users u
JOIN public.repairs r ON r.user_id = u.id
LEFT JOIN public.properties p ON p.id = r.property_id
WHERE lower(trim(u.email::text)) = 'horse0140@gmail.com'
ORDER BY r.created_at DESC
LIMIT 20;

-- Row counts (0 rows is OK if you never saved successfully)
SELECT
  '7_row_counts' AS section,
  u.email,
  (SELECT count(*) FROM public.maintenance_items m WHERE m.user_id = u.id) AS maintenance_count,
  (SELECT count(*) FROM public.repairs r WHERE r.user_id = u.id) AS repairs_count,
  (SELECT count(*) FROM public.properties p WHERE p.user_id = u.id) AS properties_count
FROM auth.users u
WHERE lower(trim(u.email::text)) = 'horse0140@gmail.com';


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 8: OPTIONAL write test (COMMENTED OUT — do not run unless debugging)
--
-- One transaction: maintenance insert + repair insert, then ROLLBACK.
-- Uncomment only if read-only sections 1–7 are not enough.
--
-- Option A — paste real UUIDs from SECTION 6 into the two literals below.
-- Option B — use the dynamic subqueries (default in this block).
--
-- On failure, Supabase shows the exact PostgreSQL error (code, column, RLS).
-- ───────────────────────────────────────────────────────────────────────────

/*
BEGIN;

-- Option A: replace literals (from section 6_founder_auth_user / 6_founder_properties)
-- WITH ids AS (
--   SELECT
--     'PASTE-AUTH-USER-UUID-HERE'::uuid AS user_id,
--     'PASTE-PROPERTY-UUID-HERE'::uuid AS property_id
-- )

-- Option B: resolve horse0140@gmail.com + most recent / selected property
WITH ids AS (
  SELECT
    u.id AS user_id,
    (
      SELECT p.id
      FROM public.properties p
      WHERE p.user_id = u.id
      ORDER BY p.is_selected DESC, p.created_at DESC
      LIMIT 1
    ) AS property_id
  FROM auth.users u
  WHERE lower(trim(u.email::text)) = 'horse0140@gmail.com'
  LIMIT 1
)
INSERT INTO public.maintenance_items (
  id, user_id, property_id, title, category,
  last_completed, next_due, status, priority, interval_days, recurring
)
SELECT
  gen_random_uuid(),
  ids.user_id,
  ids.property_id,
  'SQL diag maintenance insert',
  'General',
  NULL,
  NULL,
  'Upcoming',
  'medium',
  180,
  true
FROM ids;

WITH ids AS (
  SELECT
    u.id AS user_id,
    (
      SELECT p.id
      FROM public.properties p
      WHERE p.user_id = u.id
      ORDER BY p.is_selected DESC, p.created_at DESC
      LIMIT 1
    ) AS property_id
  FROM auth.users u
  WHERE lower(trim(u.email::text)) = 'horse0140@gmail.com'
  LIMIT 1
)
INSERT INTO public.repairs (
  id, user_id, property_id, title, contractor, category, date, cost, photo_urls
)
SELECT
  gen_random_uuid(),
  ids.user_id,
  ids.property_id,
  'SQL diag repair insert',
  'Not listed',
  'General',
  NULL,
  NULL,
  '{}'::text[]
FROM ids;

ROLLBACK;
*/
