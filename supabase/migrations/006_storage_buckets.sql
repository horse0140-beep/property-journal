-- Additional HomeWise storage buckets + RLS policies
-- Create buckets in Dashboard first (all private recommended except property-photos):
-- property-photos, repair-photos, receipts, warranties, documents, reports, leases, inspection-files

do $$
declare b text;
begin
  foreach b in array array[
    'property-photos',
    'repair-photos',
    'receipts',
    'warranties',
    'documents',
    'reports',
    'leases',
    'inspection-files'
  ] loop
    begin
      execute format($policy$
        create policy "Users upload own %1$s"
        on storage.objects for insert
        to authenticated
        with check (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
      $policy$, b);
    exception when duplicate_object then null;
    end;

    begin
      execute format($policy$
        create policy "Users read own %1$s"
        on storage.objects for select
        to authenticated
        using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
      $policy$, b);
    exception when duplicate_object then null;
    end;

    begin
      execute format($policy$
        create policy "Users update own %1$s"
        on storage.objects for update
        to authenticated
        using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
        with check (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
      $policy$, b);
    exception when duplicate_object then null;
    end;

    begin
      execute format($policy$
        create policy "Users delete own %1$s"
        on storage.objects for delete
        to authenticated
        using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
      $policy$, b);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
