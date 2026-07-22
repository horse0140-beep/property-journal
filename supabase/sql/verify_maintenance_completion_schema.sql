-- ============================================================================
-- verify_maintenance_completion_schema.sql
-- READ-ONLY — does not modify database objects.
-- Run in Supabase SQL editor against the live project.
-- ============================================================================

with expected as (
  select * from (values
    ('maintenance_items', 'table', true),
    ('status', 'column', true),
    ('last_completed', 'column', true),
    ('next_due', 'column', true),
    ('notes', 'column', true),
    ('completed_at', 'column', false),  -- not used; last_completed is the equivalent
    ('photo_urls', 'column', false),    -- must NOT exist on live for current app writes
    ('archived', 'column', false)
  ) as t(name, kind, required_or_expected_absent)
),
table_ok as (
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'maintenance_items'
  ) as pass
),
cols as (
  select column_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'maintenance_items'
),
col_checks as (
  select
    c.column_name,
    case
      when c.column_name in ('status', 'last_completed', 'next_due', 'notes', 'title', 'recurring', 'interval_days', 'priority')
        then case when exists (select 1 from cols x where x.column_name = c.column_name) then 'PASS' else 'FAIL' end
      when c.column_name = 'photo_urls'
        then case when exists (select 1 from cols x where x.column_name = 'photo_urls') then 'PRESENT (app must not write until migrated)' else 'PASS (absent — correct for current app)' end
      when c.column_name = 'archived'
        then case when exists (select 1 from cols x where x.column_name = 'archived') then 'PRESENT (app must not write)' else 'PASS (absent)' end
      when c.column_name = 'completed_at'
        then case when exists (select 1 from cols x where x.column_name = 'completed_at') then 'PRESENT (optional)' else 'PASS (use last_completed)' end
      else 'n/a'
    end as result
  from (values
    ('status'), ('last_completed'), ('next_due'), ('notes'),
    ('title'), ('recurring'), ('interval_days'), ('priority'),
    ('photo_urls'), ('archived'), ('completed_at')
  ) as c(column_name)
),
related_photo_tables as (
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public'
    and t.table_name in (
      'maintenance_photos',
      'maintenance_item_photos',
      'task_photos',
      'attachments'
    )
),
rls as (
  select
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'maintenance_items'
),
policies as (
  select policyname, cmd
  from pg_policies
  where schemaname = 'public' and tablename = 'maintenance_items'
)

-- 1) Table exists
select 'maintenance_items exists' as check_name,
  case when pass then 'PASS' else 'FAIL' end as result
from table_ok

union all

-- 2) Column checks
select 'column:' || column_name, result from col_checks

union all

-- 3) Related photo tables (informational)
select 'related_photo_table:' || coalesce(
  (select string_agg(table_name, ', ') from related_photo_tables),
  '(none)'
), case when exists (select 1 from related_photo_tables) then 'PRESENT' else 'NONE (completion photos unsupported)' end

union all

-- 4) RLS
select 'rls_enabled',
  case when rls_enabled then 'PASS' else 'FAIL' end
from rls

union all

-- 5) Update/delete policies
select 'policy_update',
  case when exists (select 1 from policies where cmd = 'UPDATE') then 'PASS' else 'FAIL' end
union all
select 'policy_delete',
  case when exists (select 1 from policies where cmd = 'DELETE') then 'PASS' else 'FAIL' end

union all

-- 6) Full column inventory (informational)
select 'all_columns', string_agg(column_name, ', ' order by column_name)
from cols;
