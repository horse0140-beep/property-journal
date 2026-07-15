-- Ensure property-photos storage bucket exists and authenticated users can manage own folder.
-- Safe to re-run. Does not modify public.photos rows.

-- ── 1. Bucket: create if missing, ensure public = true ───────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      name = EXCLUDED.name;

-- ── 2. Remove legacy policy names (004/006) to avoid duplicates ──────────────
DROP POLICY IF EXISTS "Users upload own property-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users read own property-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own property-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own property-photos" ON storage.objects;

DROP POLICY IF EXISTS property_photos_select_own ON storage.objects;
DROP POLICY IF EXISTS property_photos_insert_own ON storage.objects;
DROP POLICY IF EXISTS property_photos_update_own ON storage.objects;
DROP POLICY IF EXISTS property_photos_delete_own ON storage.objects;

-- ── 3. storage.objects policies for authenticated users ──────────────────────
-- Path convention: {auth.uid()}/{filename}
CREATE POLICY property_photos_select_own ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY property_photos_insert_own ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY property_photos_update_own ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY property_photos_delete_own ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
