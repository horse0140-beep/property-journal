-- HomeWise complete schema alignment (idempotent, preserves existing data)

-- ── properties ──────────────────────────────────────────────
alter table public.properties
  add column if not exists photo_url text,
  add column if not exists is_selected boolean not null default false,
  add column if not exists notes text default '',
  add column if not exists lot_size numeric,
  add column if not exists hoa_fee numeric,
  add column if not exists value numeric;

-- ── appliances ────────────────────────────────────────────────
alter table public.appliances
  add column if not exists category text default 'Appliance',
  add column if not exists brand text default '',
  add column if not exists model text default '',
  add column if not exists serial text default '',
  add column if not exists serial_number text default '',
  add column if not exists install_date text default '',
  add column if not exists purchase_date text default '',
  add column if not exists purchase_price numeric,
  add column if not exists expected_life_years integer default 10,
  add column if not exists warranty_expires text default '',
  add column if not exists warranty_expiration text default '',
  add column if not exists last_service text default '',
  add column if not exists next_service text default '',
  add column if not exists condition text default 'Good',
  add column if not exists notes text default '',
  add column if not exists photo_url text,
  add column if not exists manual_url text,
  add column if not exists receipt_url text,
  add column if not exists is_active boolean not null default true;

-- ── repairs ───────────────────────────────────────────────────
alter table public.repairs
  add column if not exists photo_urls text[] default '{}',
  add column if not exists receipt_url text,
  add column if not exists warranty_expires text;

-- ── maintenance_items ───────────────────────────────────────
alter table public.maintenance_items
  add column if not exists recurring boolean not null default false,
  add column if not exists interval_days integer,
  add column if not exists priority text default 'medium';

-- ── paint_colors ──────────────────────────────────────────────
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

alter table public.paint_colors
  add column if not exists purchase_date text default '',
  add column if not exists notes text default '',
  add column if not exists brand text default '',
  add column if not exists color_name text default '',
  add column if not exists color_code text default '',
  add column if not exists finish text default '',
  add column if not exists hex text default '';

-- ── contractors ───────────────────────────────────────────────
alter table public.contractors
  add column if not exists license_number text default '',
  add column if not exists website text default '',
  add column if not exists last_used text default '',
  add column if not exists property_id uuid references public.properties(id) on delete set null;

-- ── documents ─────────────────────────────────────────────────
alter table public.documents
  add column if not exists expires_date text,
  add column if not exists file_size text default '',
  add column if not exists category text default 'other';

-- ── receipts ──────────────────────────────────────────────────
alter table public.receipts
  add column if not exists file_size text default '';

-- ── warranties ────────────────────────────────────────────────
alter table public.warranties
  add column if not exists file_size text default '',
  add column if not exists expires_date text;

-- ── property_scores ───────────────────────────────────────────
create table if not exists public.property_scores (
  id uuid primary key default gen_random_uuid(),
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

alter table public.property_scores
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.property_scores ps
set user_id = p.user_id
from public.properties p
where ps.property_id = p.id and ps.user_id is null;

delete from public.property_scores where user_id is null;

-- ── property_shares ───────────────────────────────────────────
create table if not exists public.property_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id text not null,
  property_label text not null,
  share_token text not null unique,
  label text not null default 'Property Share',
  expires_at timestamptz,
  is_active boolean not null default true,
  views_count integer not null default 0,
  include_personal_info boolean not null default false,
  snapshot_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_shares_user_id_idx on public.property_shares(user_id);
create index if not exists property_shares_token_idx on public.property_shares(share_token);
create index if not exists property_shares_property_id_idx on public.property_shares(property_id);

drop trigger if exists property_shares_updated_at on public.property_shares;
create trigger property_shares_updated_at
  before update on public.property_shares
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
alter table public.paint_colors enable row level security;
alter table public.property_shares enable row level security;
alter table public.property_scores enable row level security;

drop policy if exists "Users manage own paint_colors" on public.paint_colors;
create policy "Users manage own paint_colors" on public.paint_colors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own property shares" on public.property_shares;
create policy "Users manage own property shares" on public.property_shares
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read active shares by token" on public.property_shares;
create policy "Public read active shares by token" on public.property_shares
  for select using (is_active = true);

drop policy if exists "Users manage own property_scores" on public.property_scores;
create policy "Users manage own property_scores" on public.property_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Admins read all property_scores" on public.property_scores;
create policy "Admins read all property_scores" on public.property_scores
  for select using (public.is_super_admin());
