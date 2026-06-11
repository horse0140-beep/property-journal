-- HomeWise Admin System tables
-- Run in Supabase SQL Editor or via supabase db push

-- ── user_roles ──────────────────────────────────────────────
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null default 'user'
    check (role in ('user', 'super_admin', 'support', 'moderator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── pricing_plans ───────────────────────────────────────────
create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique
    check (plan_key in ('free', 'premium', 'landlord', 'realtor')),
  name text not null,
  monthly_price numeric(10,2) not null default 0,
  yearly_price numeric(10,2) not null default 0,
  description text,
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── promo_codes ─────────────────────────────────────────────
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null default 'percent'
    check (discount_type in ('percent', 'fixed', 'free_trial')),
  discount_value numeric(10,2) not null default 0,
  plan_scope text not null default 'all'
    check (plan_scope in ('free', 'premium', 'landlord', 'realtor', 'all')),
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── support_tickets ─────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── subscriptions (for admin billing management) ────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_key text not null
    check (plan_key in ('free', 'premium', 'landlord', 'realtor')),
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'past_due', 'trialing', 'expired')),
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'yearly')),
  amount numeric(10,2) not null default 0,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── updated_at trigger ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_roles_updated_at on public.user_roles;
create trigger user_roles_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

drop trigger if exists pricing_plans_updated_at on public.pricing_plans;
create trigger pricing_plans_updated_at
  before update on public.pricing_plans
  for each row execute function public.set_updated_at();

drop trigger if exists promo_codes_updated_at on public.promo_codes;
create trigger promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ── helper: is super admin ──────────────────────────────────
create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$ language sql security definer stable;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.user_roles enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.promo_codes enable row level security;
alter table public.support_tickets enable row level security;
alter table public.subscriptions enable row level security;

-- user_roles: users read own role; admins full access
create policy "Users read own role" on public.user_roles
  for select using (auth.uid() = user_id);

create policy "Admins manage roles" on public.user_roles
  for all using (public.is_super_admin());

-- pricing_plans: everyone reads active plans; admins manage
create policy "Anyone reads active pricing" on public.pricing_plans
  for select using (is_active = true or public.is_super_admin());

create policy "Admins manage pricing" on public.pricing_plans
  for all using (public.is_super_admin());

-- promo_codes: admins only
create policy "Admins manage promo codes" on public.promo_codes
  for all using (public.is_super_admin());

-- support_tickets: users create/read own; admins full access
create policy "Users manage own tickets" on public.support_tickets
  for all using (auth.uid() = user_id);

create policy "Admins manage all tickets" on public.support_tickets
  for all using (public.is_super_admin());

-- subscriptions: users read own; admins full access
create policy "Users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "Admins manage subscriptions" on public.subscriptions
  for all using (public.is_super_admin());

-- ── profiles admin access (if profiles table already exists) ──
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    execute 'alter table public.profiles enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and policyname = 'Admins manage profiles'
    ) then
      execute $policy$
        create policy "Admins manage profiles" on public.profiles
          for all using (public.is_super_admin())
      $policy$;
    end if;
  end if;
end $$;

-- ── seed default pricing ────────────────────────────────────
insert into public.pricing_plans (plan_key, name, monthly_price, yearly_price, description, features, sort_order)
values
  ('free', 'Free', 0, 0, 'Get started with one property',
   array['1 property', 'Basic health score', 'Manual entries'], 0),
  ('premium', 'Premium', 4.99, 39.99, 'For homeowners who want full protection',
   array['Unlimited properties', 'PDF reports', 'AI assistant', 'Cloud backup'], 1),
  ('landlord', 'Landlord Pro', 14.99, 149.99, 'Manage multiple rental units',
   array['Unlimited properties', 'Tenant sharing', 'Bulk reports', 'Priority support'], 2),
  ('realtor', 'Realtor Pro', 29.99, 299.99, 'Professional tools for agents',
   array['Buyer share links', 'Branded reports', 'Client management', 'Priority support'], 3)
on conflict (plan_key) do nothing;
