-- Push Notification Center: broadcasts + extra profile prefs
-- Run after 008_promo_redemption.sql

alter table public.profiles
  add column if not exists appliance_reminders boolean not null default true;

alter table public.profiles
  add column if not exists subscription_reminders boolean not null default true;

alter table public.profiles
  add column if not exists admin_broadcasts boolean not null default true;

create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sent_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_broadcast_reads (
  user_id uuid references auth.users(id) on delete cascade not null,
  broadcast_id uuid references public.notification_broadcasts(id) on delete cascade not null,
  read_at timestamptz not null default now(),
  primary key (user_id, broadcast_id)
);

alter table public.notification_broadcasts enable row level security;
alter table public.user_broadcast_reads enable row level security;

drop policy if exists "Authenticated read active broadcasts" on public.notification_broadcasts;
create policy "Authenticated read active broadcasts" on public.notification_broadcasts
  for select using (auth.uid() is not null and is_active = true);

drop policy if exists "Admins manage broadcasts" on public.notification_broadcasts;
create policy "Admins manage broadcasts" on public.notification_broadcasts
  for all using (public.is_super_admin());

drop policy if exists "Users manage own broadcast reads" on public.user_broadcast_reads;
create policy "Users manage own broadcast reads" on public.user_broadcast_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
