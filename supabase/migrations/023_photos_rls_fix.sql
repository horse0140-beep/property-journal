-- Repair public.photos ownership + RLS (safe to re-run).

alter table public.photos add column if not exists user_id uuid;
alter table public.photos add column if not exists property_id uuid;
alter table public.photos add column if not exists file_url text default '';
alter table public.photos add column if not exists photo_url text default '';
alter table public.photos add column if not exists caption text default '';
alter table public.photos add column if not exists date text default '';
alter table public.photos add column if not exists category text default 'general';

update public.photos ph
set user_id = p.user_id
from public.properties p
where ph.property_id = p.id
  and ph.user_id is null
  and p.user_id is not null;

alter table public.photos enable row level security;

drop policy if exists "Users manage own photos" on public.photos;
drop policy if exists "Admins read all photos" on public.photos;
drop policy if exists photos_select_own on public.photos;
drop policy if exists photos_insert_own on public.photos;
drop policy if exists photos_update_own on public.photos;
drop policy if exists photos_delete_own on public.photos;

create policy photos_select_own on public.photos
  for select
  using (user_id = auth.uid());

create policy photos_insert_own on public.photos
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.user_id = auth.uid()
    )
  );

create policy photos_update_own on public.photos
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.user_id = auth.uid()
    )
  );

create policy photos_delete_own on public.photos
  for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.photos to authenticated;
