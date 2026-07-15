-- ============================================================
-- verify_date_column_types.sql  (READ-ONLY — safe to run)
-- Confirms the live data types of every date-like column the
-- app writes to. Run in Supabase SQL Editor and paste results.
--
-- Context: device errors 22007 ("invalid input syntax for type
-- date") prove maintenance_items.next_due / repairs.date are
-- real `date` columns in production, even though migrations
-- declared them `text`. The app now always sends ISO
-- YYYY-MM-DD, which is valid for BOTH text and date columns,
-- so no schema migration is required.
-- ============================================================

-- 1. Date-like columns across all app tables
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'properties', 'maintenance_items', 'repairs', 'appliances',
    'documents', 'receipts', 'warranties', 'paint_colors', 'photos'
  )
  and (
    column_name like '%date%'
    or column_name like '%_due'
    or column_name like '%completed%'
    or column_name like '%expires%'
    or column_name like '%expiration%'
  )
order by table_name, column_name;

-- 2. Foreign keys referencing properties, with their delete rules
--    (confirms whether ON DELETE CASCADE exists in the live DB)
select
  tc.table_name as child_table,
  kcu.column_name,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.referential_constraints rc
  on tc.constraint_name = rc.constraint_name
 and tc.table_schema = rc.constraint_schema
join information_schema.constraint_column_usage ccu
  on rc.unique_constraint_name = ccu.constraint_name
 and rc.unique_constraint_schema = ccu.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and ccu.table_name = 'properties'
order by tc.table_name;

-- 3. DELETE policies on properties and child tables
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and cmd = 'DELETE'
  and tablename in (
    'properties', 'maintenance_items', 'repairs', 'appliances',
    'documents', 'receipts', 'warranties', 'paint_colors', 'photos',
    'property_scores', 'property_shares', 'reports', 'maintenance_forecasts',
    'contractors'
  )
order by tablename;

-- 4. Storage buckets used by documents and repair photos
select id, name, public
from storage.buckets
where name in (
  'documents', 'receipts', 'warranties', 'leases', 'inspection-files',
  'repair-photos', 'property-photos', 'before-after-photos', 'reports'
)
order by name;

-- 5. Storage RLS policies (upload permissions for authenticated users)
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
