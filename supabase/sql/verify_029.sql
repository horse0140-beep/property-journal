-- verify_029.sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'maintenance_items'
  and column_name = 'archived';
-- Expect: archived | boolean | false | NO
