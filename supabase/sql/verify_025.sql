-- HomeWise 025 verification (READ-ONLY)
-- Run after: supabase/migrations/025_property_photos_storage_fix.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- PASS / FAIL summary (run this block first)
-- ═══════════════════════════════════════════════════════════════════════════
WITH
required_policies AS (
  SELECT unnest(ARRAY[
    'property_photos_select_own',
    'property_photos_insert_own',
    'property_photos_update_own',
    'property_photos_delete_own'
  ]::text[]) AS policyname
),
checks AS (
  SELECT 'bucket_exists' AS check_group,
         CASE WHEN EXISTS (
           SELECT 1 FROM storage.buckets WHERE id = 'property-photos'
         ) THEN 0 ELSE 1 END AS fail_count,
         1 AS total_count

  UNION ALL

  SELECT 'bucket_public',
         CASE WHEN EXISTS (
           SELECT 1 FROM storage.buckets
           WHERE id = 'property-photos' AND public IS TRUE
         ) THEN 0 ELSE 1 END,
         1

  UNION ALL

  SELECT 'storage_policies',
         count(*) FILTER (WHERE p.policyname IS NULL),
         count(*)
  FROM required_policies rp
  LEFT JOIN pg_policies p
    ON p.schemaname = 'storage'
   AND p.tablename = 'objects'
   AND p.policyname = rp.policyname
)
SELECT
  check_group,
  CASE WHEN fail_count = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
  fail_count AS failures,
  total_count AS checked
FROM checks
ORDER BY check_group;

-- ═══════════════════════════════════════════════════════════════════════════
-- Detail: property-photos bucket row
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  id,
  name,
  public,
  created_at,
  updated_at
FROM storage.buckets
WHERE id = 'property-photos';

-- ═══════════════════════════════════════════════════════════════════════════
-- Detail: missing storage policies (should return 0 rows after 025)
-- ═══════════════════════════════════════════════════════════════════════════
WITH required AS (
  SELECT unnest(ARRAY[
    'property_photos_select_own',
    'property_photos_insert_own',
    'property_photos_update_own',
    'property_photos_delete_own'
  ]::text[]) AS policyname
)
SELECT r.policyname, '✗ Missing' AS status
FROM required r
LEFT JOIN pg_policies p
  ON p.schemaname = 'storage'
 AND p.tablename = 'objects'
 AND p.policyname = r.policyname
WHERE p.policyname IS NULL
ORDER BY r.policyname;

-- ═══════════════════════════════════════════════════════════════════════════
-- Detail: property-photos policies present
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  policyname,
  cmd,
  roles,
  qual IS NOT NULL AS has_using,
  with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'property_photos_%'
ORDER BY policyname;
