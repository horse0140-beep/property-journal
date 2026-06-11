-- Storage bucket policies for HomeWise
-- Create buckets first in Dashboard: receipts, warranties, documents, property-photos, repair-photos

do $$
declare b text;
begin
  foreach b in array array['receipts','warranties','documents','property-photos','repair-photos'] loop
    execute format($policy$
      create policy "Users upload own %1$s"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$, b);

    execute format($policy$
      create policy "Users read own %1$s"
      on storage.objects for select
      to authenticated
      using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$, b);

    execute format($policy$
      create policy "Users delete own %1$s"
      on storage.objects for delete
      to authenticated
      using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text)
    $policy$, b);
  end loop;
exception
  when duplicate_object then null;
end $$;
