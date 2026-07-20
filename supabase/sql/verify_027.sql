-- ============================================================================
-- verify_027 — Document storage buckets + policies
-- Run in Supabase SQL editor after applying 027_document_storage_fix.sql
-- ============================================================================

-- 1. Buckets exist and are private
SELECT
  id,
  name,
  public,
  CASE
    WHEN public = false THEN 'OK private'
    ELSE 'FAIL expected public=false'
  END AS status
FROM storage.buckets
WHERE id IN (
  'documents',
  'receipts',
  'warranties',
  'leases',
  'inspection-files',
  'reports'
)
ORDER BY id;

-- Expect 6 rows, all public = false
SELECT
  CASE
    WHEN count(*) = 6 AND bool_and(public = false) THEN 'PASS: all 6 document buckets private'
    ELSE format('FAIL: found %s buckets (expected 6 private)', count(*))
  END AS bucket_check
FROM storage.buckets
WHERE id IN (
  'documents',
  'receipts',
  'warranties',
  'leases',
  'inspection-files',
  'reports'
);

-- 2. Required storage.objects policies present
WITH expected(policy_name) AS (
  VALUES
    ('documents_select_own'),
    ('documents_insert_own'),
    ('documents_update_own'),
    ('documents_delete_own'),
    ('receipts_select_own'),
    ('receipts_insert_own'),
    ('receipts_update_own'),
    ('receipts_delete_own'),
    ('warranties_select_own'),
    ('warranties_insert_own'),
    ('warranties_update_own'),
    ('warranties_delete_own'),
    ('leases_select_own'),
    ('leases_insert_own'),
    ('leases_update_own'),
    ('leases_delete_own'),
    ('inspection_files_select_own'),
    ('inspection_files_insert_own'),
    ('inspection_files_update_own'),
    ('inspection_files_delete_own'),
    ('reports_select_own'),
    ('reports_insert_own'),
    ('reports_update_own'),
    ('reports_delete_own')
)
SELECT
  e.policy_name,
  CASE WHEN p.policyname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM expected e
LEFT JOIN pg_policies p
  ON p.schemaname = 'storage'
 AND p.tablename = 'objects'
 AND p.policyname = e.policy_name
ORDER BY e.policy_name;

SELECT
  CASE
    WHEN count(*) = 24 THEN 'PASS: all 24 document storage policies present'
    ELSE format('FAIL: %s/24 policies present', count(*))
  END AS policy_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'documents_select_own', 'documents_insert_own', 'documents_update_own', 'documents_delete_own',
    'receipts_select_own', 'receipts_insert_own', 'receipts_update_own', 'receipts_delete_own',
    'warranties_select_own', 'warranties_insert_own', 'warranties_update_own', 'warranties_delete_own',
    'leases_select_own', 'leases_insert_own', 'leases_update_own', 'leases_delete_own',
    'inspection_files_select_own', 'inspection_files_insert_own', 'inspection_files_update_own', 'inspection_files_delete_own',
    'reports_select_own', 'reports_insert_own', 'reports_update_own', 'reports_delete_own'
  );

-- 3. Spot-check path predicate uses auth.uid() folder
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'documents_select_own',
    'documents_insert_own',
    'receipts_insert_own',
    'warranties_insert_own'
  )
ORDER BY policyname;
