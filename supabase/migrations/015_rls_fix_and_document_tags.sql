-- Fix RLS for user-owned rows + align documents.tags with app (003 defines tags; live DB may lack column)

-- ── documents.tags (optional metadata; receipts/warranties already have tags in 003) ──
alter table public.documents
  add column if not exists tags text[] default '{}';

alter table public.receipts
  add column if not exists tags text[] default '{}';

alter table public.warranties
  add column if not exists tags text[] default '{}';

-- ── RLS: explicit per-operation policies (fixes insert/update/delete denied errors) ──
do $$
declare
  t text;
  tables text[] := array[
    'maintenance_items',
    'repairs',
    'appliances',
    'contractors',
    'paint_colors',
    'documents',
    'receipts'
  ];
  op text;
  ops text[] := array['select', 'insert', 'update', 'delete'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    -- Drop legacy bundled policy from 003
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);

    foreach op in array ops loop
      execute format('drop policy if exists %I on public.%I', t || '_' || op || '_own', t);
    end loop;

    execute format(
      'create policy "%I_select_own" on public.%I for select using (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy "%I_insert_own" on public.%I for insert with check (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy "%I_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy "%I_delete_own" on public.%I for delete using (auth.uid() = user_id)',
      t, t
    );
  end loop;
end $$;

-- Admins read all (re-create idempotently)
do $$
declare
  t text;
  tables text[] := array[
    'maintenance_items',
    'repairs',
    'appliances',
    'contractors',
    'paint_colors',
    'documents',
    'receipts'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "Admins read all %I" on public.%I', t, t);
    execute format(
      'create policy "Admins read all %I" on public.%I for select using (public.is_super_admin())',
      t, t
    );
  end loop;
end $$;
