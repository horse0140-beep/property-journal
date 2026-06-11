-- HomeWise core property data + scores + vault tables

-- ── properties ──────────────────────────────────────────────
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nickname text,
  address text not null,
  city text default '',
  state text default '',
  zip text default '',
  type text default 'primary' check (type in ('primary', 'rental', 'vacation', 'investment')),
  year_built text default '',
  square_feet text default '',
  bedrooms text default '',
  bathrooms text default '',
  purchase_price text default '',
  estimated_value text default '',
  purchase_date text default '',
  photo_url text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── maintenance_items ─────────────────────────────────────
create table if not exists public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  category text default '',
  last_completed text default '',
  next_due text default '',
  status text default 'Upcoming' check (status in ('Upcoming', 'Due Soon', 'Overdue', 'Completed')),
  notes text default '',
  recurring boolean not null default false,
  interval_days integer,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── repairs ───────────────────────────────────────────────
create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  date text default '',
  cost text default '',
  contractor text default '',
  category text default '',
  notes text default '',
  photo_urls text[] default '{}',
  receipt_url text,
  warranty_expires text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── appliances ────────────────────────────────────────────
create table if not exists public.appliances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  name text not null,
  category text default '',
  brand text default '',
  model text default '',
  serial text default '',
  install_date text default '',
  purchase_price text default '',
  expected_life_years integer default 10,
  warranty_expires text default '',
  last_service text default '',
  next_service text default '',
  condition text default 'Good' check (condition in ('Excellent', 'Good', 'Fair', 'Poor', 'Replace Soon')),
  notes text default '',
  photo_url text,
  manual_url text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── documents (general vault) ───────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  category text default 'other',
  file_url text,
  file_type text default 'pdf',
  file_size text default '',
  upload_date text default '',
  expires_date text,
  notes text default '',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── receipts ────────────────────────────────────────────────
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  file_url text,
  file_type text default 'pdf',
  file_size text default '',
  upload_date text default '',
  notes text default '',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── warranties ──────────────────────────────────────────────
create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  file_url text,
  file_type text default 'pdf',
  file_size text default '',
  upload_date text default '',
  expires_date text,
  notes text default '',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── photos ──────────────────────────────────────────────────
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  file_url text not null,
  caption text default '',
  date text default '',
  category text default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── property_scores ─────────────────────────────────────────
create table if not exists public.property_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null unique,
  overall integer not null default 0,
  maintenance integer not null default 0,
  appliances integer not null default 0,
  repairs integer not null default 0,
  warranty integer not null default 0,
  inspections integer not null default 0,
  label text not null default 'Fair',
  updated_at timestamptz not null default now()
);

-- ── contractors (maintenance tab) ─────────────────────────
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete set null,
  name text not null,
  trade text default '',
  phone text default '',
  email text default '',
  website text default '',
  rating integer default 5,
  notes text default '',
  last_used text default '',
  license_number text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── paint_colors (maintenance tab) ──────────────────────────
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

-- ── updated_at triggers ─────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'properties','maintenance_items','repairs','appliances','documents',
    'receipts','warranties','photos','contractors','paint_colors'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ── RLS: user owns their rows ───────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'properties','maintenance_items','repairs','appliances','documents',
    'receipts','warranties','photos','property_scores','contractors','paint_colors'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);
    execute format(
      'create policy "Users manage own %I" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end $$;

-- Admins read all property data
do $$
declare t text;
begin
  foreach t in array array[
    'properties','maintenance_items','repairs','appliances','documents',
    'receipts','warranties','photos','property_scores'
  ] loop
    execute format('drop policy if exists "Admins read all %I" on public.%I', t, t);
    execute format(
      'create policy "Admins read all %I" on public.%I for select using (public.is_super_admin())',
      t, t
    );
  end loop;
end $$;

-- ── Storage bucket policies (run if buckets exist) ──────────
-- In Supabase Dashboard > Storage, create buckets:
-- receipts, warranties, documents, property-photos, repair-photos
-- Then add policies allowing authenticated users to upload/read own folder: {user_id}/*
