-- verify_028.sql — prove multi-entity photo columns exist
-- Run in Supabase SQL editor after applying 028_multi_entity_photos.sql

select
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name
from information_schema.columns c
where c.table_schema = 'public'
  and (
    (c.table_name = 'appliances' and c.column_name in ('photo_url', 'photo_urls'))
    or (c.table_name = 'maintenance_items' and c.column_name = 'photo_urls')
    or (c.table_name = 'repairs' and c.column_name = 'photo_urls')
  )
order by c.table_name, c.column_name;

-- Expect:
--   appliances.photo_url     text
--   appliances.photo_urls    ARRAY (udt_name = _text)
--   maintenance_items.photo_urls  ARRAY
--   repairs.photo_urls       ARRAY
