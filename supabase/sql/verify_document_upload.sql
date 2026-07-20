-- ============================================================================
-- verify_document_upload.sql — READ-ONLY checks for document upload prerequisites
-- Does NOT modify production. Run in Supabase SQL editor.
-- ============================================================================

-- A. Document storage buckets exist + privacy
WITH expected(bucket_id, expect_public) AS (
  VALUES
    ('documents', false),
    ('receipts', false),
    ('warranties', false),
    ('leases', false),
    ('inspection-files', false),
    ('reports', false)
)
SELECT
  e.bucket_id,
  CASE WHEN b.id IS NULL THEN 'FAIL: bucket missing'
       WHEN b.public IS DISTINCT FROM e.expect_public THEN format('FAIL: public=%s expected %s', b.public, e.expect_public)
       ELSE 'PASS'
  END AS status,
  b.public AS is_public
FROM expected e
LEFT JOIN storage.buckets b ON b.id = e.bucket_id
ORDER BY e.bucket_id;

-- B. Storage object policies for documents bucket (path = auth.uid()/…)
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
    ('warranties_delete_own')
)
SELECT
  e.policy_name,
  CASE WHEN p.policyname IS NULL THEN 'FAIL: missing'
       ELSE 'PASS'
  END AS status
FROM expected e
LEFT JOIN pg_policies p
  ON p.schemaname = 'storage'
 AND p.tablename = 'objects'
 AND p.policyname = e.policy_name
ORDER BY e.policy_name;

-- Also accept legacy policy names from migration 004/006
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname ILIKE '%documents%'
    OR policyname ILIKE '%receipts%'
    OR policyname ILIKE '%warranties%'
    OR qual ILIKE '%documents%'
    OR with_check ILIKE '%documents%'
  )
ORDER BY policyname;

-- C. Table RLS + policies for documents / receipts / warranties
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL: RLS disabled' END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('documents', 'receipts', 'warranties')
ORDER BY c.relname;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('documents', 'receipts', 'warranties')
ORDER BY tablename, policyname;

-- D. Required columns on documents table (app payload)
WITH required(column_name) AS (
  VALUES
    ('id'), ('user_id'), ('property_id'), ('title'), ('category'),
    ('file_url'), ('file_type'), ('file_size'), ('upload_date'),
    ('expires_date'), ('notes'), ('created_at')
)
SELECT
  r.column_name,
  CASE WHEN cols.column_name IS NULL THEN 'FAIL: missing column' ELSE 'PASS' END AS status,
  cols.data_type
FROM required r
LEFT JOIN information_schema.columns cols
  ON cols.table_schema = 'public'
 AND cols.table_name = 'documents'
 AND cols.column_name = r.column_name
ORDER BY r.column_name;

-- Note: app does NOT currently insert storage_bucket / storage_path / file_name / mime_type
-- columns. Those would show FAIL if expected above — they are intentionally omitted.

-- E. Summary
SELECT
  (SELECT count(*) FROM storage.buckets
   WHERE id IN ('documents','receipts','warranties','leases','inspection-files','reports')) AS document_buckets_found,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN (
       'documents_select_own','documents_insert_own','documents_update_own','documents_delete_own'
     )) AS documents_storage_policies_named,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'documents') AS documents_table_policies;
