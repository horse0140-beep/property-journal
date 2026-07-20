-- ============================================================================
-- 027 — Document storage buckets + RLS policies
--
-- Live production probe (anon GET /storage/v1/bucket/{id}) returned:
--   documents, receipts, warranties, leases, inspection-files, reports
--   → {"error":"Bucket not found"}
--
-- Migrations 004/006 only created policies and assumed Dashboard buckets.
-- Photos are handled by 025 — do not alter photo buckets here.
--
-- Path convention (must match app uploadLocalFile): {auth.uid()}/{filename}
-- Buckets are PRIVATE — app uses createSignedUrl, not getPublicUrl.
-- ============================================================================

-- ── 1. Ensure private document buckets exist ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documents', 'documents', false),
  ('receipts', 'receipts', false),
  ('warranties', 'warranties', false),
  ('leases', 'leases', false),
  ('inspection-files', 'inspection-files', false),
  ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      name = EXCLUDED.name;

-- ── 2. Drop legacy / conflicting policy names (004/006 + prior 027) ─────────
DO $$
DECLARE
  b text;
  legacy text;
BEGIN
  FOREACH b IN ARRAY ARRAY[
    'documents',
    'receipts',
    'warranties',
    'leases',
    'inspection-files',
    'reports'
  ]
  LOOP
    FOREACH legacy IN ARRAY ARRAY[
      format('Users upload own %s', b),
      format('Users read own %s', b),
      format('Users update own %s', b),
      format('Users delete own %s', b),
      format('document_%s_select_own', replace(b, '-', '_')),
      format('document_%s_insert_own', replace(b, '-', '_')),
      format('document_%s_update_own', replace(b, '-', '_')),
      format('document_%s_delete_own', replace(b, '-', '_'))
    ]
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', legacy);
    END LOOP;
  END LOOP;
END $$;

DROP POLICY IF EXISTS documents_select_own ON storage.objects;
DROP POLICY IF EXISTS documents_insert_own ON storage.objects;
DROP POLICY IF EXISTS documents_update_own ON storage.objects;
DROP POLICY IF EXISTS documents_delete_own ON storage.objects;

DROP POLICY IF EXISTS receipts_select_own ON storage.objects;
DROP POLICY IF EXISTS receipts_insert_own ON storage.objects;
DROP POLICY IF EXISTS receipts_update_own ON storage.objects;
DROP POLICY IF EXISTS receipts_delete_own ON storage.objects;

DROP POLICY IF EXISTS warranties_select_own ON storage.objects;
DROP POLICY IF EXISTS warranties_insert_own ON storage.objects;
DROP POLICY IF EXISTS warranties_update_own ON storage.objects;
DROP POLICY IF EXISTS warranties_delete_own ON storage.objects;

DROP POLICY IF EXISTS leases_select_own ON storage.objects;
DROP POLICY IF EXISTS leases_insert_own ON storage.objects;
DROP POLICY IF EXISTS leases_update_own ON storage.objects;
DROP POLICY IF EXISTS leases_delete_own ON storage.objects;

DROP POLICY IF EXISTS inspection_files_select_own ON storage.objects;
DROP POLICY IF EXISTS inspection_files_insert_own ON storage.objects;
DROP POLICY IF EXISTS inspection_files_update_own ON storage.objects;
DROP POLICY IF EXISTS inspection_files_delete_own ON storage.objects;

DROP POLICY IF EXISTS reports_select_own ON storage.objects;
DROP POLICY IF EXISTS reports_insert_own ON storage.objects;
DROP POLICY IF EXISTS reports_update_own ON storage.objects;
DROP POLICY IF EXISTS reports_delete_own ON storage.objects;

-- ── 3. Authenticated SELECT / INSERT / UPDATE / DELETE for own folder ───────
-- documents
CREATE POLICY documents_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY documents_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY documents_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY documents_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- receipts
CREATE POLICY receipts_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY receipts_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY receipts_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY receipts_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- warranties
CREATE POLICY warranties_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'warranties' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY warranties_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'warranties' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY warranties_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'warranties' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'warranties' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY warranties_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'warranties' AND (storage.foldername(name))[1] = auth.uid()::text);

-- leases (contract category)
CREATE POLICY leases_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'leases' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY leases_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'leases' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY leases_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'leases' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'leases' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY leases_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'leases' AND (storage.foldername(name))[1] = auth.uid()::text);

-- inspection-files
CREATE POLICY inspection_files_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY inspection_files_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspection-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY inspection_files_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'inspection-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'inspection-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY inspection_files_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inspection-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- reports
CREATE POLICY reports_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY reports_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY reports_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY reports_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);
