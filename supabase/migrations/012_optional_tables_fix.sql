-- Optional tables/columns used by the app but not required for core flows.

alter table public.properties
  add column if not exists photo_url text;

-- paint_colors (maintenance tab — optional)
create table if not exists public.paint_colors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  room text not null,
  brand text default '',
  color_name text default '',
  color_code text default '',
  finish text default '',
  hex text default '',
  purchase_date text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paint_colors enable row level security;

drop policy if exists "Users manage own paint_colors" on public.paint_colors;
create policy "Users manage own paint_colors" on public.paint_colors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
