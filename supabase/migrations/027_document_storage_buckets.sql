-- ============================================================================
-- 027 — Ensure document-related private storage buckets exist.
--
-- Migrations 004/006 only added RLS policies and assumed buckets were created
-- in the Dashboard. Preview builds that upload documents fail when the
-- `documents` (and related) buckets are missing.
-- Photos/repairs already covered by 025/026 — do not alter those here.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documents', 'documents', false),
  ('receipts', 'receipts', false),
  ('warranties', 'warranties', false),
  ('leases', 'leases', false),
  ('inspection-files', 'inspection-files', false),
  ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;
