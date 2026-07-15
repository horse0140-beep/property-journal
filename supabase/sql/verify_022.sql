-- HomeWise 022 verification (READ-ONLY)
-- Run after: supabase/migrations/022_production_targeted_fix.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- PASS / FAIL summary (run this block first)
-- ═══════════════════════════════════════════════════════════════════════════
WITH
expected_tables AS (
  SELECT unnest(ARRAY[
    'admin_actions','contractor_portal_access','maintenance_forecasts',
    'notification_broadcasts','push_tokens','stripe_customers','user_broadcast_reads'
  ]::text[]) AS table_name
),
expected_columns AS (
  SELECT * FROM (VALUES
    ('documents','tags'),('documents','updated_at'),('documents','upload_date'),
    ('receipts','file_type'),('receipts','tags'),('receipts','updated_at'),('receipts','upload_date'),
    ('warranties','file_type'),('warranties','tags'),('warranties','updated_at'),('warranties','upload_date'),
    ('appliances','updated_at'),('contractors','updated_at'),('maintenance_items','updated_at'),
    ('paint_colors','updated_at'),
    ('photos','caption'),('photos','date'),('photos','file_url'),('photos','updated_at'),
    ('pricing_plans','updated_at'),
    ('profiles','admin_broadcasts'),('profiles','appliance_reminders'),
    ('profiles','subscription_reminders'),('profiles','updated_at'),
    ('promo_codes','description'),('promo_codes','discount_type'),('promo_codes','discount_value'),
    ('promo_codes','plan_scope'),('promo_codes','updated_at'),('promo_codes','used_count'),
    ('properties','updated_at'),
    ('property_scores','appliances'),('property_scores','inspections'),('property_scores','label'),
    ('property_scores','maintenance'),('property_scores','overall'),('property_scores','repairs'),
    ('property_scores','warranty'),
    ('support_tickets','admin_notes'),('support_tickets','updated_at'),('support_tickets','user_email'),
    ('user_entitlements','granted_by')
  ) AS v(table_name, column_name)
),
rls_tables AS (
  SELECT unnest(ARRAY[
    'maintenance_items','repairs','appliances','contractors','documents'
  ]::text[]) AS table_name
),
required_policies AS (
  SELECT * FROM (VALUES
    ('maintenance_items','maintenance_items_select_own'),
    ('maintenance_items','maintenance_items_insert_own'),
    ('maintenance_items','maintenance_items_update_own'),
    ('maintenance_items','maintenance_items_delete_own'),
    ('repairs','repairs_select_own'),
    ('repairs','repairs_insert_own'),
    ('repairs','repairs_update_own'),
    ('repairs','repairs_delete_own'),
    ('appliances','appliances_select_own'),
    ('appliances','appliances_insert_own'),
    ('appliances','appliances_update_own'),
    ('appliances','appliances_delete_own'),
    ('contractors','contractors_select_own'),
    ('contractors','contractors_insert_own'),
    ('contractors','contractors_update_own'),
    ('contractors','contractors_delete_own'),
    ('documents','documents_select_own'),
    ('documents','documents_insert_own'),
    ('documents','documents_update_own'),
    ('documents','documents_delete_own')
  ) AS v(tablename, policyname)
),
trigger_tables AS (
  SELECT unnest(ARRAY[
    'documents','receipts','warranties','appliances','contractors',
    'maintenance_items','paint_colors','photos','pricing_plans','profiles',
    'properties','promo_codes','support_tickets'
  ]::text[]) AS table_name
),
checks AS (
  SELECT 'tables' AS check_group,
         count(*) FILTER (WHERE t.table_name IS NULL) AS fail_count,
         count(*) AS total_count
  FROM expected_tables e
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public' AND t.table_name = e.table_name AND t.table_type = 'BASE TABLE'

  UNION ALL

  SELECT 'columns',
         count(*) FILTER (WHERE c.column_name IS NULL),
         count(*)
  FROM expected_columns e
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name

  UNION ALL

  SELECT 'rls_enabled',
         count(*) FILTER (WHERE NOT coalesce(rel.relrowsecurity, false)),
         count(*)
  FROM rls_tables rt
  LEFT JOIN pg_class rel ON rel.relname = rt.table_name
  LEFT JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace AND nsp.nspname = 'public'

  UNION ALL

  SELECT 'rls_policies',
         count(*) FILTER (WHERE p.policyname IS NULL),
         count(*)
  FROM required_policies rp
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public' AND p.tablename = rp.tablename AND p.policyname = rp.policyname

  UNION ALL

  SELECT 'updated_at_triggers',
         count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM pg_trigger tg
           JOIN pg_class c ON c.oid = tg.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = tt.table_name
             AND tg.tgname = tt.table_name || '_updated_at' AND NOT tg.tgisinternal
         )),
         count(*)
  FROM trigger_tables tt
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tt.table_name AND c.column_name = 'updated_at'
  )

  UNION ALL

  SELECT 'duplicate_triggers',
         coalesce(sum(dup.cnt - 1), 0)::bigint,
         count(*)
  FROM (
    SELECT tg.tgname, c.relname, count(*) AS cnt
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal AND tg.tgname LIKE '%\_updated_at' ESCAPE '\'
    GROUP BY tg.tgname, c.relname
    HAVING count(*) > 1
  ) dup

  UNION ALL

  SELECT 'founder_accounts',
         count(*) FILTER (WHERE u.id IS NULL),
         2
  FROM (VALUES ('horse0140@gmail.com'), ('hdmccoy180@gmail.com')) AS f(email)
  LEFT JOIN auth.users u ON lower(u.email::text) = lower(f.email)
)
SELECT
  check_group,
  CASE WHEN fail_count = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
  fail_count AS failures,
  total_count AS checked
FROM checks
ORDER BY check_group;

-- ═══════════════════════════════════════════════════════════════════════════
-- Detail: missing columns (should return 0 rows after 022)
-- ═══════════════════════════════════════════════════════════════════════════
WITH expected AS (
  SELECT * FROM (VALUES
    ('documents','tags'),('documents','updated_at'),('documents','upload_date'),
    ('receipts','file_type'),('receipts','tags'),('receipts','updated_at'),('receipts','upload_date'),
    ('warranties','file_type'),('warranties','tags'),('warranties','updated_at'),('warranties','upload_date'),
    ('appliances','updated_at'),('contractors','updated_at'),('maintenance_items','updated_at'),
    ('paint_colors','updated_at'),
    ('photos','caption'),('photos','date'),('photos','file_url'),('photos','updated_at'),
    ('pricing_plans','updated_at'),
    ('profiles','admin_broadcasts'),('profiles','appliance_reminders'),
    ('profiles','subscription_reminders'),('profiles','updated_at'),
    ('promo_codes','description'),('promo_codes','discount_type'),('promo_codes','discount_value'),
    ('promo_codes','plan_scope'),('promo_codes','updated_at'),('promo_codes','used_count'),
    ('properties','updated_at'),
    ('property_scores','appliances'),('property_scores','inspections'),('property_scores','label'),
    ('property_scores','maintenance'),('property_scores','overall'),('property_scores','repairs'),
    ('property_scores','warranty'),
    ('support_tickets','admin_notes'),('support_tickets','updated_at'),('support_tickets','user_email'),
    ('user_entitlements','granted_by')
  ) AS v(table_name, column_name)
)
SELECT e.table_name, e.column_name, '✗ Missing' AS status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name
WHERE c.column_name IS NULL
ORDER BY 1, 2;

-- ═══════════════════════════════════════════════════════════════════════════
-- Detail: founder accounts preserved (read-only snapshot)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT u.email, ur.role, ue.entitlement
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.user_entitlements ue ON ue.user_id = u.id
WHERE lower(u.email) IN ('horse0140@gmail.com','hdmccoy180@gmail.com')
ORDER BY u.email, ue.entitlement;

-- ═══════════════════════════════════════════════════════════════════════════
-- Detail: per-column ✓ / ✗ summary
-- ═══════════════════════════════════════════════════════════════════════════
WITH expected AS (
  SELECT * FROM (VALUES
    ('documents','tags'),('documents','updated_at'),('documents','upload_date'),
    ('receipts','file_type'),('receipts','tags'),('receipts','updated_at'),('receipts','upload_date'),
    ('warranties','file_type'),('warranties','tags'),('warranties','updated_at'),('warranties','upload_date'),
    ('appliances','updated_at'),('contractors','updated_at'),('maintenance_items','updated_at'),
    ('paint_colors','updated_at'),
    ('photos','caption'),('photos','date'),('photos','file_url'),('photos','updated_at'),
    ('pricing_plans','updated_at'),
    ('profiles','admin_broadcasts'),('profiles','appliance_reminders'),
    ('profiles','subscription_reminders'),('profiles','updated_at'),
    ('promo_codes','description'),('promo_codes','discount_type'),('promo_codes','discount_value'),
    ('promo_codes','plan_scope'),('promo_codes','updated_at'),('promo_codes','used_count'),
    ('properties','updated_at'),
    ('property_scores','appliances'),('property_scores','inspections'),('property_scores','label'),
    ('property_scores','maintenance'),('property_scores','overall'),('property_scores','repairs'),
    ('property_scores','warranty'),
    ('support_tickets','admin_notes'),('support_tickets','updated_at'),('support_tickets','user_email'),
    ('user_entitlements','granted_by')
  ) AS v(table_name, column_name)
)
SELECT
  e.table_name,
  e.column_name,
  CASE WHEN c.column_name IS NOT NULL THEN '✓ Exists' ELSE '✗ Missing' END AS status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name
ORDER BY e.table_name, e.column_name;
