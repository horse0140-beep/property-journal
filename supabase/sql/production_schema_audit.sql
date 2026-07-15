-- ═══════════════════════════════════════════════════════════════════════════
-- HomeWise — Production Schema Audit (READ-ONLY)
-- File: supabase/sql/production_schema_audit.sql
--
-- SAFE: This script only SELECTs from catalog views. It does NOT create,
-- alter, update, insert, or delete anything.
--
-- Run in Supabase Dashboard → SQL Editor → paste entire file → Run.
-- Copy ALL result tabs and share them to generate a targeted fix migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: Missing tables (referenced by app code)
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'profiles','user_roles','user_entitlements','pricing_plans','promo_codes',
    'properties','maintenance_items','repairs','appliances','contractors',
    'documents','receipts','warranties','paint_colors','photos','property_scores',
    'notification_broadcasts','user_broadcast_reads',
    'support_tickets','subscriptions','stripe_customers','property_shares',
    'contractor_portal_access','maintenance_forecasts','reports','admin_actions',
    'push_tokens'
  ]::text[]) AS table_name
),
actual_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
SELECT
  '1_missing_tables' AS section,
  e.table_name,
  'MISSING' AS status
FROM expected_tables e
LEFT JOIN actual_tables a ON a.table_name = e.table_name
WHERE a.table_name IS NULL
ORDER BY e.table_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: Missing columns (every column referenced by app / migrations)
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_columns AS (
  SELECT * FROM (VALUES
    ('profiles','id'),('profiles','email'),('profiles','name'),('profiles','phone'),
    ('profiles','avatar_uri'),('profiles','plan'),('profiles','notifications_enabled'),
    ('profiles','maintenance_reminders'),('profiles','warranty_alerts'),
    ('profiles','appliance_reminders'),('profiles','subscription_reminders'),
    ('profiles','admin_broadcasts'),('profiles','email_digest'),
    ('profiles','created_at'),('profiles','updated_at'),
    ('user_roles','id'),('user_roles','user_id'),('user_roles','role'),
    ('user_roles','created_at'),('user_roles','updated_at'),
    ('user_entitlements','id'),('user_entitlements','user_id'),('user_entitlements','entitlement'),
    ('user_entitlements','granted_by'),('user_entitlements','created_at'),
    ('pricing_plans','id'),('pricing_plans','plan_key'),('pricing_plans','name'),
    ('pricing_plans','monthly_price'),('pricing_plans','yearly_price'),
    ('pricing_plans','description'),('pricing_plans','features'),('pricing_plans','is_active'),
    ('pricing_plans','sort_order'),('pricing_plans','created_at'),('pricing_plans','updated_at'),
    ('promo_codes','id'),('promo_codes','code'),('promo_codes','description'),
    ('promo_codes','discount_type'),('promo_codes','discount_value'),('promo_codes','plan_scope'),
    ('promo_codes','max_uses'),('promo_codes','used_count'),('promo_codes','is_active'),
    ('promo_codes','expires_at'),('promo_codes','created_at'),('promo_codes','updated_at'),
    ('properties','id'),('properties','user_id'),('properties','nickname'),('properties','address'),
    ('properties','city'),('properties','state'),('properties','zip'),('properties','type'),
    ('properties','property_type'),('properties','property_name'),('properties','street_address'),
    ('properties','year_built'),('properties','square_feet'),('properties','bedrooms'),
    ('properties','bathrooms'),('properties','purchase_price'),('properties','estimated_value'),
    ('properties','value'),('properties','purchase_date'),('properties','photo_url'),
    ('properties','image_url'),('properties','is_selected'),('properties','is_primary'),
    ('properties','is_active'),('properties','created_at'),('properties','updated_at'),
    ('maintenance_items','id'),('maintenance_items','user_id'),('maintenance_items','property_id'),
    ('maintenance_items','title'),('maintenance_items','category'),('maintenance_items','last_completed'),
    ('maintenance_items','next_due'),('maintenance_items','status'),('maintenance_items','notes'),
    ('maintenance_items','recurring'),('maintenance_items','interval_days'),('maintenance_items','priority'),
    ('maintenance_items','created_at'),('maintenance_items','updated_at'),
    ('repairs','id'),('repairs','user_id'),('repairs','property_id'),('repairs','title'),
    ('repairs','date'),('repairs','cost'),('repairs','contractor'),('repairs','category'),
    ('repairs','notes'),('repairs','photo_urls'),('repairs','receipt_url'),('repairs','warranty_expires'),
    ('repairs','created_at'),('repairs','updated_at'),
    ('appliances','id'),('appliances','user_id'),('appliances','property_id'),('appliances','name'),
    ('appliances','category'),('appliances','brand'),('appliances','model'),('appliances','serial'),
    ('appliances','serial_number'),('appliances','install_date'),('appliances','purchase_date'),
    ('appliances','purchase_price'),('appliances','expected_life_years'),('appliances','warranty_expires'),
    ('appliances','warranty_expiration'),('appliances','last_service'),('appliances','next_service'),
    ('appliances','condition'),('appliances','notes'),('appliances','photo_url'),('appliances','manual_url'),
    ('appliances','receipt_url'),('appliances','created_at'),('appliances','updated_at'),
    ('contractors','id'),('contractors','user_id'),('contractors','property_id'),('contractors','name'),
    ('contractors','trade'),('contractors','phone'),('contractors','email'),('contractors','website'),
    ('contractors','rating'),('contractors','notes'),('contractors','last_used'),('contractors','license_number'),
    ('contractors','created_at'),('contractors','updated_at'),
    ('documents','id'),('documents','user_id'),('documents','property_id'),('documents','title'),
    ('documents','category'),('documents','file_url'),('documents','file_type'),('documents','file_size'),
    ('documents','upload_date'),('documents','expires_date'),('documents','notes'),('documents','tags'),
    ('documents','created_at'),('documents','updated_at'),
    ('receipts','id'),('receipts','user_id'),('receipts','property_id'),('receipts','title'),
    ('receipts','file_url'),('receipts','file_type'),('receipts','file_size'),('receipts','upload_date'),
    ('receipts','notes'),('receipts','tags'),('receipts','created_at'),('receipts','updated_at'),
    ('warranties','id'),('warranties','user_id'),('warranties','property_id'),('warranties','title'),
    ('warranties','file_url'),('warranties','file_type'),('warranties','file_size'),('warranties','upload_date'),
    ('warranties','expires_date'),('warranties','notes'),('warranties','tags'),
    ('warranties','created_at'),('warranties','updated_at'),
    ('paint_colors','id'),('paint_colors','user_id'),('paint_colors','property_id'),('paint_colors','room'),
    ('paint_colors','brand'),('paint_colors','color_name'),('paint_colors','color_code'),('paint_colors','finish'),
    ('paint_colors','hex'),('paint_colors','purchase_date'),('paint_colors','notes'),
    ('paint_colors','created_at'),('paint_colors','updated_at'),
    ('photos','id'),('photos','user_id'),('photos','property_id'),('photos','file_url'),
    ('photos','caption'),('photos','date'),('photos','category'),('photos','created_at'),('photos','updated_at'),
    ('property_scores','id'),('property_scores','user_id'),('property_scores','property_id'),
    ('property_scores','overall'),('property_scores','maintenance'),('property_scores','appliances'),
    ('property_scores','repairs'),('property_scores','warranty'),('property_scores','inspections'),
    ('property_scores','label'),('property_scores','updated_at'),
    ('notification_broadcasts','id'),('notification_broadcasts','title'),('notification_broadcasts','body'),
    ('notification_broadcasts','sent_by'),('notification_broadcasts','is_active'),('notification_broadcasts','created_at'),
    ('user_broadcast_reads','user_id'),('user_broadcast_reads','broadcast_id'),('user_broadcast_reads','read_at'),
    ('support_tickets','id'),('support_tickets','user_id'),('support_tickets','user_email'),
    ('support_tickets','subject'),('support_tickets','message'),('support_tickets','status'),
    ('support_tickets','priority'),('support_tickets','admin_notes'),
    ('support_tickets','created_at'),('support_tickets','updated_at'),
    ('subscriptions','id'),('subscriptions','user_id'),('subscriptions','plan_key'),('subscriptions','status'),
    ('subscriptions','billing_cycle'),('subscriptions','amount'),('subscriptions','promo_code_id'),
    ('subscriptions','started_at'),('subscriptions','expires_at'),('subscriptions','cancelled_at'),
    ('subscriptions','created_at'),('subscriptions','updated_at'),
    ('stripe_customers','id'),('stripe_customers','user_id'),('stripe_customers','stripe_customer_id'),
    ('stripe_customers','stripe_subscription_id'),('stripe_customers','plan_key'),('stripe_customers','status'),
    ('stripe_customers','current_period_end'),('stripe_customers','created_at'),('stripe_customers','updated_at'),
    ('property_shares','id'),('property_shares','user_id'),('property_shares','property_id'),
    ('property_shares','property_label'),('property_shares','share_token'),('property_shares','label'),
    ('property_shares','expires_at'),('property_shares','is_active'),('property_shares','views_count'),
    ('property_shares','include_personal_info'),('property_shares','snapshot_json'),
    ('property_shares','created_at'),('property_shares','updated_at'),
    ('contractor_portal_access','id'),('contractor_portal_access','user_id'),('contractor_portal_access','property_id'),
    ('contractor_portal_access','property_label'),('contractor_portal_access','contractor_name'),
    ('contractor_portal_access','contractor_email'),('contractor_portal_access','contractor_phone'),
    ('contractor_portal_access','trade'),('contractor_portal_access','access_code'),('contractor_portal_access','permissions'),
    ('contractor_portal_access','notes'),('contractor_portal_access','is_active'),('contractor_portal_access','last_accessed_at'),
    ('contractor_portal_access','created_at'),('contractor_portal_access','updated_at'),
    ('maintenance_forecasts','id'),('maintenance_forecasts','user_id'),('maintenance_forecasts','property_id'),
    ('maintenance_forecasts','summary'),('maintenance_forecasts','items'),('maintenance_forecasts','annual_budget'),
    ('maintenance_forecasts','generated_at'),
    ('reports','id'),('reports','user_id'),('reports','property_id'),('reports','property_address'),
    ('reports','title'),('reports','file_url'),('reports','health_score'),('reports','maintenance_count'),
    ('reports','repair_count'),('reports','appliance_count'),('reports','document_count'),('reports','photo_count'),
    ('reports','generated_at'),('reports','created_at'),
    ('admin_actions','id'),('admin_actions','actor_user_id'),('admin_actions','actor_email'),
    ('admin_actions','target_user_id'),('admin_actions','target_email'),('admin_actions','action'),
    ('admin_actions','metadata'),('admin_actions','created_at'),
    ('push_tokens','id'),('push_tokens','user_id'),('push_tokens','token'),('push_tokens','platform'),
    ('push_tokens','created_at'),('push_tokens','updated_at')
  ) AS v(table_name, column_name)
),
actual_columns AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
table_exists AS (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
SELECT
  '2_missing_columns' AS section,
  e.table_name,
  e.column_name,
  CASE WHEN t.table_name IS NULL THEN 'TABLE_MISSING' ELSE 'MISSING' END AS status
FROM expected_columns e
LEFT JOIN table_exists t ON t.table_name = e.table_name
LEFT JOIN actual_columns a ON a.table_name = e.table_name AND a.column_name = e.column_name
WHERE t.table_name IS NULL OR a.column_name IS NULL
ORDER BY e.table_name, e.column_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: Missing indexes (by expected index name)
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_indexes AS (
  SELECT * FROM (VALUES
    ('user_roles_user_id_uidx','user_roles'),
    ('user_entitlements_user_entitlement_uidx','user_entitlements'),
    ('pricing_plans_plan_key_uidx','pricing_plans'),
    ('promo_codes_code_uidx','promo_codes'),
    ('property_scores_property_id_uidx','property_scores'),
    ('push_tokens_user_token_uidx','push_tokens'),
    ('stripe_customers_user_id_uidx','stripe_customers'),
    ('maintenance_forecasts_user_property_uidx','maintenance_forecasts'),
    ('reports_user_property_idx','reports'),
    ('admin_actions_created_at_idx','admin_actions'),
    ('admin_actions_target_user_idx','admin_actions')
  ) AS v(index_name, table_name)
),
actual_indexes AS (
  SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public'
)
SELECT
  '3_missing_indexes' AS section,
  e.index_name,
  e.table_name,
  'MISSING' AS status
FROM expected_indexes e
LEFT JOIN actual_indexes a ON a.indexname = e.index_name
WHERE a.indexname IS NULL
ORDER BY e.index_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Missing foreign keys (child table + column → parent)
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_fks AS (
  SELECT * FROM (VALUES
    ('profiles','id','auth','users'),
    ('user_roles','user_id','auth','users'),
    ('user_entitlements','user_id','auth','users'),
    ('user_entitlements','granted_by','auth','users'),
    ('properties','user_id','auth','users'),
    ('maintenance_items','user_id','auth','users'),
    ('maintenance_items','property_id','public','properties'),
    ('repairs','user_id','auth','users'),
    ('repairs','property_id','public','properties'),
    ('appliances','user_id','auth','users'),
    ('appliances','property_id','public','properties'),
    ('contractors','user_id','auth','users'),
    ('contractors','property_id','public','properties'),
    ('documents','user_id','auth','users'),
    ('documents','property_id','public','properties'),
    ('receipts','user_id','auth','users'),
    ('receipts','property_id','public','properties'),
    ('warranties','user_id','auth','users'),
    ('warranties','property_id','public','properties'),
    ('paint_colors','user_id','auth','users'),
    ('paint_colors','property_id','public','properties'),
    ('photos','user_id','auth','users'),
    ('photos','property_id','public','properties'),
    ('property_scores','user_id','auth','users'),
    ('property_scores','property_id','public','properties'),
    ('notification_broadcasts','sent_by','auth','users'),
    ('user_broadcast_reads','user_id','auth','users'),
    ('user_broadcast_reads','broadcast_id','public','notification_broadcasts'),
    ('support_tickets','user_id','auth','users'),
    ('subscriptions','user_id','auth','users'),
    ('subscriptions','promo_code_id','public','promo_codes'),
    ('stripe_customers','user_id','auth','users'),
    ('property_shares','user_id','auth','users'),
    ('contractor_portal_access','user_id','auth','users'),
    ('maintenance_forecasts','user_id','auth','users'),
    ('reports','user_id','auth','users'),
    ('reports','property_id','public','properties'),
    ('push_tokens','user_id','auth','users')
  ) AS v(child_table, child_column, parent_schema, parent_table)
),
actual_fks AS (
  SELECT
    tc.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_schema AS parent_schema,
    ccu.table_name AS parent_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
)
SELECT
  '4_missing_foreign_keys' AS section,
  e.child_table,
  e.child_column,
  e.parent_schema || '.' || e.parent_table AS references_table,
  'MISSING' AS status
FROM expected_fks e
LEFT JOIN actual_fks a
  ON a.child_table = e.child_table AND a.child_column = e.child_column
 AND a.parent_schema = e.parent_schema AND a.parent_table = e.parent_table
WHERE a.child_table IS NULL
ORDER BY e.child_table, e.child_column;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5: Missing triggers (by trigger name)
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_triggers AS (
  SELECT * FROM (VALUES
    ('profiles_updated_at','profiles'),
    ('user_roles_updated_at','user_roles'),
    ('pricing_plans_updated_at','pricing_plans'),
    ('promo_codes_updated_at','promo_codes'),
    ('properties_updated_at','properties'),
    ('maintenance_items_updated_at','maintenance_items'),
    ('repairs_updated_at','repairs'),
    ('appliances_updated_at','appliances'),
    ('contractors_updated_at','contractors'),
    ('documents_updated_at','documents'),
    ('receipts_updated_at','receipts'),
    ('warranties_updated_at','warranties'),
    ('paint_colors_updated_at','paint_colors'),
    ('photos_updated_at','photos'),
    ('support_tickets_updated_at','support_tickets'),
    ('subscriptions_updated_at','subscriptions'),
    ('property_shares_updated_at','property_shares'),
    ('contractor_portal_access_updated_at','contractor_portal_access'),
    ('stripe_customers_updated_at','stripe_customers'),
    ('protect_founder_profile_delete','profiles'),
    ('protect_founder_profile_update','profiles'),
    ('protect_founder_user_roles','user_roles'),
    ('ensure_founder_user_roles','user_roles'),
    ('protect_founder_entitlements','user_entitlements')
  ) AS v(trigger_name, table_name)
),
actual_triggers AS (
  SELECT trigger_name, event_object_table AS table_name
  FROM information_schema.triggers WHERE trigger_schema = 'public'
)
SELECT
  '5_missing_triggers' AS section,
  e.trigger_name,
  e.table_name,
  'MISSING' AS status
FROM expected_triggers e
LEFT JOIN actual_triggers a ON a.trigger_name = e.trigger_name AND a.table_name = e.table_name
WHERE a.trigger_name IS NULL
ORDER BY e.table_name, e.trigger_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6: Missing RLS policies
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_policies AS (
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
    ('documents','documents_delete_own'),
    ('properties','properties_select_own'),
    ('properties','properties_insert_own'),
    ('properties','properties_update_own'),
    ('properties','properties_delete_own'),
    ('receipts','receipts_select_own'),
    ('receipts','receipts_insert_own'),
    ('warranties','warranties_select_own'),
    ('warranties','warranties_insert_own'),
    ('paint_colors','paint_colors_select_own'),
    ('paint_colors','paint_colors_insert_own'),
    ('photos','photos_select_own'),
    ('photos','photos_insert_own'),
    ('property_scores','property_scores_select_own'),
    ('property_scores','property_scores_insert_own'),
    ('profiles','profiles_select_own'),
    ('profiles','profiles_insert_own'),
    ('profiles','profiles_update_own'),
    ('profiles','profiles_admin_all'),
    ('user_roles','user_roles_select_own'),
    ('user_roles','user_roles_admin_all'),
    ('user_entitlements','user_entitlements_select_own'),
    ('user_entitlements','user_entitlements_admin_all'),
    ('pricing_plans','pricing_plans_select_active'),
    ('pricing_plans','pricing_plans_insert_admin'),
    ('pricing_plans','pricing_plans_update_admin'),
    ('pricing_plans','pricing_plans_delete_admin'),
    ('promo_codes','promo_codes_select_admin'),
    ('promo_codes','promo_codes_insert_admin'),
    ('promo_codes','promo_codes_update_admin'),
    ('promo_codes','promo_codes_delete_admin'),
    ('notification_broadcasts','notification_broadcasts_select_active'),
    ('notification_broadcasts','notification_broadcasts_insert_admin'),
    ('user_broadcast_reads','user_broadcast_reads_all_own'),
    ('support_tickets','Users manage own support tickets'),
    ('subscriptions','Users manage own subscriptions'),
    ('reports','Users manage own reports'),
    ('push_tokens','Users manage own push tokens'),
    ('property_shares','Users manage own property shares'),
    ('contractor_portal_access','Users manage own contractor access'),
    ('maintenance_forecasts','Users manage own forecasts'),
    ('stripe_customers','Users read own stripe record'),
    ('admin_actions','Super admins read admin_actions'),
    ('admin_actions','Super admins insert admin_actions')
  ) AS v(tablename, policyname)
),
actual_policies AS (
  SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
)
SELECT
  '6_missing_rls_policies' AS section,
  e.tablename,
  e.policyname,
  'MISSING' AS status
FROM expected_policies e
LEFT JOIN actual_policies a ON a.tablename = e.tablename AND a.policyname = e.policyname
WHERE a.policyname IS NULL
ORDER BY e.tablename, e.policyname;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 7: Missing RPC functions
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_functions AS (
  SELECT unnest(ARRAY[
    'bootstrap_owner_admin','delete_own_account','validate_promo_code','redeem_promo_code',
    'is_super_admin','ensure_founder_full_access','is_founder_email','is_founder_user','set_updated_at'
  ]::text[]) AS function_name
),
actual_functions AS (
  SELECT p.proname AS function_name
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  '7_missing_rpc_functions' AS section,
  e.function_name,
  'MISSING' AS status
FROM expected_functions e
LEFT JOIN actual_functions a ON a.function_name = e.function_name
WHERE a.function_name IS NULL
ORDER BY e.function_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 8: Missing storage buckets
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_buckets AS (
  SELECT unnest(ARRAY[
    'property-photos','repair-photos','receipts','warranties',
    'documents','reports','leases','inspection-files'
  ]::text[]) AS bucket_name
),
actual_buckets AS (
  SELECT name AS bucket_name FROM storage.buckets
)
SELECT
  '8_missing_storage_buckets' AS section,
  e.bucket_name,
  'MISSING' AS status
FROM expected_buckets e
LEFT JOIN actual_buckets a ON a.bucket_name = e.bucket_name
WHERE a.bucket_name IS NULL
ORDER BY e.bucket_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 9: Missing unique constraints / unique indexes
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_uniques AS (
  SELECT * FROM (VALUES
    ('user_roles_user_id_uidx','user_roles'),
    ('user_entitlements_user_entitlement_uidx','user_entitlements'),
    ('pricing_plans_plan_key_uidx','pricing_plans'),
    ('promo_codes_code_uidx','promo_codes'),
    ('property_scores_property_id_uidx','property_scores'),
    ('push_tokens_user_token_uidx','push_tokens'),
    ('stripe_customers_user_id_uidx','stripe_customers'),
    ('maintenance_forecasts_user_property_uidx','maintenance_forecasts')
  ) AS v(index_name, table_name)
),
actual_uniques AS (
  SELECT indexname AS name, tablename AS table_name
  FROM pg_indexes WHERE schemaname = 'public' AND indexdef ILIKE '%unique%'
  UNION
  SELECT con.conname AS name, rel.relname AS table_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public' AND con.contype = 'u'
)
SELECT
  '9_missing_unique_constraints' AS section,
  e.index_name,
  e.table_name,
  'MISSING' AS status
FROM expected_uniques e
LEFT JOIN actual_uniques a ON a.name = e.index_name AND a.table_name = e.table_name
WHERE a.name IS NULL
ORDER BY e.table_name, e.index_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 10: Tables with RLS disabled
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_rls_tables AS (
  SELECT unnest(ARRAY[
    'profiles','user_roles','user_entitlements','pricing_plans','promo_codes',
    'properties','maintenance_items','repairs','appliances','contractors',
    'documents','receipts','warranties','paint_colors','photos','property_scores',
    'notification_broadcasts','user_broadcast_reads',
    'support_tickets','subscriptions','stripe_customers','property_shares',
    'contractor_portal_access','maintenance_forecasts','reports','admin_actions',
    'push_tokens'
  ]::text[]) AS table_name
),
table_rls AS (
  SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
)
SELECT
  '10_rls_disabled' AS section,
  e.table_name,
  CASE WHEN t.table_name IS NULL THEN 'TABLE_MISSING' ELSE 'RLS_DISABLED' END AS status
FROM expected_rls_tables e
LEFT JOIN table_rls t ON t.table_name = e.table_name
WHERE t.table_name IS NULL OR NOT t.rls_enabled
ORDER BY e.table_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 11: Code-referenced tables missing from production
-- ───────────────────────────────────────────────────────────────────────────
WITH code_tables AS (
  SELECT unnest(ARRAY[
    'profiles','user_roles','user_entitlements','pricing_plans','promo_codes',
    'properties','maintenance_items','repairs','appliances','contractors',
    'documents','receipts','warranties','paint_colors','photos','property_scores',
    'notification_broadcasts','user_broadcast_reads',
    'support_tickets','subscriptions','stripe_customers','property_shares',
    'contractor_portal_access','maintenance_forecasts','reports','admin_actions',
    'push_tokens'
  ]::text[]) AS table_name
),
production_tables AS (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
SELECT
  '11_code_tables_missing' AS section,
  c.table_name,
  'REFERENCED_BY_APP_BUT_NOT_IN_PRODUCTION' AS status
FROM code_tables c
LEFT JOIN production_tables p ON p.table_name = c.table_name
WHERE p.table_name IS NULL
ORDER BY c.table_name;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 12: Critical checks (known production failure points)
-- ───────────────────────────────────────────────────────────────────────────
WITH critical AS (
  SELECT * FROM (VALUES
    ('table',  'pricing_plans',           NULL::text),
    ('table',  'notification_broadcasts', NULL::text),
    ('column', 'documents',               'upload_date'),
    ('column', 'promo_codes',             'discount_type'),
    ('column', 'maintenance_items',       'user_id'),
    ('column', 'repairs',                 'user_id'),
    ('column', 'appliances',              'user_id'),
    ('column', 'contractors',             'user_id'),
    ('column', 'user_roles',              'updated_at')
  ) AS v(kind, table_name, column_name)
),
tables AS (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
),
columns AS (
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public'
)
SELECT
  '12_critical_checks' AS section,
  c.kind,
  c.table_name,
  c.column_name,
  CASE
    WHEN c.kind = 'table' AND t.table_name IS NOT NULL THEN '✓ Exists'
    WHEN c.kind = 'table' THEN '✗ Missing'
    WHEN col.column_name IS NOT NULL THEN '✓ Exists'
    WHEN t.table_name IS NULL THEN '✗ Missing (table absent)'
    ELSE '✗ Missing'
  END AS status
FROM critical c
LEFT JOIN tables t ON t.table_name = c.table_name
LEFT JOIN columns col ON col.table_name = c.table_name AND col.column_name = c.column_name
ORDER BY c.kind DESC, c.table_name, c.column_name;


-- ───────────────────────────────────────────────────────────────────────────
-- FINAL SUMMARY: ✓ Exists / ✗ Missing for every required table and column
-- ───────────────────────────────────────────────────────────────────────────
WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'profiles','user_roles','user_entitlements','pricing_plans','promo_codes',
    'properties','maintenance_items','repairs','appliances','contractors',
    'documents','receipts','warranties','paint_colors','photos','property_scores',
    'notification_broadcasts','user_broadcast_reads',
    'support_tickets','subscriptions','stripe_customers','property_shares',
    'contractor_portal_access','maintenance_forecasts','reports','admin_actions',
    'push_tokens'
  ]::text[]) AS table_name
),
expected_columns AS (
  SELECT * FROM (VALUES
    ('profiles','id'),('profiles','email'),('profiles','name'),('profiles','phone'),
    ('profiles','avatar_uri'),('profiles','plan'),('profiles','notifications_enabled'),
    ('profiles','maintenance_reminders'),('profiles','warranty_alerts'),
    ('profiles','appliance_reminders'),('profiles','subscription_reminders'),
    ('profiles','admin_broadcasts'),('profiles','email_digest'),
    ('profiles','created_at'),('profiles','updated_at'),
    ('user_roles','id'),('user_roles','user_id'),('user_roles','role'),
    ('user_roles','created_at'),('user_roles','updated_at'),
    ('user_entitlements','id'),('user_entitlements','user_id'),('user_entitlements','entitlement'),
    ('user_entitlements','granted_by'),('user_entitlements','created_at'),
    ('pricing_plans','id'),('pricing_plans','plan_key'),('pricing_plans','name'),
    ('pricing_plans','monthly_price'),('pricing_plans','yearly_price'),
    ('pricing_plans','description'),('pricing_plans','features'),('pricing_plans','is_active'),
    ('pricing_plans','sort_order'),('pricing_plans','created_at'),('pricing_plans','updated_at'),
    ('promo_codes','id'),('promo_codes','code'),('promo_codes','description'),
    ('promo_codes','discount_type'),('promo_codes','discount_value'),('promo_codes','plan_scope'),
    ('promo_codes','max_uses'),('promo_codes','used_count'),('promo_codes','is_active'),
    ('promo_codes','expires_at'),('promo_codes','created_at'),('promo_codes','updated_at'),
    ('properties','id'),('properties','user_id'),('properties','nickname'),('properties','address'),
    ('properties','city'),('properties','state'),('properties','zip'),('properties','type'),
    ('properties','property_type'),('properties','property_name'),('properties','street_address'),
    ('properties','year_built'),('properties','square_feet'),('properties','bedrooms'),
    ('properties','bathrooms'),('properties','purchase_price'),('properties','estimated_value'),
    ('properties','value'),('properties','purchase_date'),('properties','photo_url'),
    ('properties','image_url'),('properties','is_selected'),('properties','is_primary'),
    ('properties','is_active'),('properties','created_at'),('properties','updated_at'),
    ('maintenance_items','id'),('maintenance_items','user_id'),('maintenance_items','property_id'),
    ('maintenance_items','title'),('maintenance_items','category'),('maintenance_items','last_completed'),
    ('maintenance_items','next_due'),('maintenance_items','status'),('maintenance_items','notes'),
    ('maintenance_items','recurring'),('maintenance_items','interval_days'),('maintenance_items','priority'),
    ('maintenance_items','created_at'),('maintenance_items','updated_at'),
    ('repairs','id'),('repairs','user_id'),('repairs','property_id'),('repairs','title'),
    ('repairs','date'),('repairs','cost'),('repairs','contractor'),('repairs','category'),
    ('repairs','notes'),('repairs','photo_urls'),('repairs','receipt_url'),('repairs','warranty_expires'),
    ('repairs','created_at'),('repairs','updated_at'),
    ('appliances','id'),('appliances','user_id'),('appliances','property_id'),('appliances','name'),
    ('appliances','category'),('appliances','brand'),('appliances','model'),('appliances','serial'),
    ('appliances','serial_number'),('appliances','install_date'),('appliances','purchase_date'),
    ('appliances','purchase_price'),('appliances','expected_life_years'),('appliances','warranty_expires'),
    ('appliances','warranty_expiration'),('appliances','last_service'),('appliances','next_service'),
    ('appliances','condition'),('appliances','notes'),('appliances','photo_url'),('appliances','manual_url'),
    ('appliances','receipt_url'),('appliances','created_at'),('appliances','updated_at'),
    ('contractors','id'),('contractors','user_id'),('contractors','property_id'),('contractors','name'),
    ('contractors','trade'),('contractors','phone'),('contractors','email'),('contractors','website'),
    ('contractors','rating'),('contractors','notes'),('contractors','last_used'),('contractors','license_number'),
    ('contractors','created_at'),('contractors','updated_at'),
    ('documents','id'),('documents','user_id'),('documents','property_id'),('documents','title'),
    ('documents','category'),('documents','file_url'),('documents','file_type'),('documents','file_size'),
    ('documents','upload_date'),('documents','expires_date'),('documents','notes'),('documents','tags'),
    ('documents','created_at'),('documents','updated_at'),
    ('receipts','id'),('receipts','user_id'),('receipts','property_id'),('receipts','title'),
    ('receipts','file_url'),('receipts','file_type'),('receipts','file_size'),('receipts','upload_date'),
    ('receipts','notes'),('receipts','tags'),('receipts','created_at'),('receipts','updated_at'),
    ('warranties','id'),('warranties','user_id'),('warranties','property_id'),('warranties','title'),
    ('warranties','file_url'),('warranties','file_type'),('warranties','file_size'),('warranties','upload_date'),
    ('warranties','expires_date'),('warranties','notes'),('warranties','tags'),
    ('warranties','created_at'),('warranties','updated_at'),
    ('paint_colors','id'),('paint_colors','user_id'),('paint_colors','property_id'),('paint_colors','room'),
    ('paint_colors','brand'),('paint_colors','color_name'),('paint_colors','color_code'),('paint_colors','finish'),
    ('paint_colors','hex'),('paint_colors','purchase_date'),('paint_colors','notes'),
    ('paint_colors','created_at'),('paint_colors','updated_at'),
    ('photos','id'),('photos','user_id'),('photos','property_id'),('photos','file_url'),
    ('photos','caption'),('photos','date'),('photos','category'),('photos','created_at'),('photos','updated_at'),
    ('property_scores','id'),('property_scores','user_id'),('property_scores','property_id'),
    ('property_scores','overall'),('property_scores','maintenance'),('property_scores','appliances'),
    ('property_scores','repairs'),('property_scores','warranty'),('property_scores','inspections'),
    ('property_scores','label'),('property_scores','updated_at'),
    ('notification_broadcasts','id'),('notification_broadcasts','title'),('notification_broadcasts','body'),
    ('notification_broadcasts','sent_by'),('notification_broadcasts','is_active'),('notification_broadcasts','created_at'),
    ('user_broadcast_reads','user_id'),('user_broadcast_reads','broadcast_id'),('user_broadcast_reads','read_at'),
    ('support_tickets','id'),('support_tickets','user_id'),('support_tickets','user_email'),
    ('support_tickets','subject'),('support_tickets','message'),('support_tickets','status'),
    ('support_tickets','priority'),('support_tickets','admin_notes'),
    ('support_tickets','created_at'),('support_tickets','updated_at'),
    ('subscriptions','id'),('subscriptions','user_id'),('subscriptions','plan_key'),('subscriptions','status'),
    ('subscriptions','billing_cycle'),('subscriptions','amount'),('subscriptions','promo_code_id'),
    ('subscriptions','started_at'),('subscriptions','expires_at'),('subscriptions','cancelled_at'),
    ('subscriptions','created_at'),('subscriptions','updated_at'),
    ('stripe_customers','id'),('stripe_customers','user_id'),('stripe_customers','stripe_customer_id'),
    ('stripe_customers','stripe_subscription_id'),('stripe_customers','plan_key'),('stripe_customers','status'),
    ('stripe_customers','current_period_end'),('stripe_customers','created_at'),('stripe_customers','updated_at'),
    ('property_shares','id'),('property_shares','user_id'),('property_shares','property_id'),
    ('property_shares','property_label'),('property_shares','share_token'),('property_shares','label'),
    ('property_shares','expires_at'),('property_shares','is_active'),('property_shares','views_count'),
    ('property_shares','include_personal_info'),('property_shares','snapshot_json'),
    ('property_shares','created_at'),('property_shares','updated_at'),
    ('contractor_portal_access','id'),('contractor_portal_access','user_id'),('contractor_portal_access','property_id'),
    ('contractor_portal_access','property_label'),('contractor_portal_access','contractor_name'),
    ('contractor_portal_access','contractor_email'),('contractor_portal_access','contractor_phone'),
    ('contractor_portal_access','trade'),('contractor_portal_access','access_code'),('contractor_portal_access','permissions'),
    ('contractor_portal_access','notes'),('contractor_portal_access','is_active'),('contractor_portal_access','last_accessed_at'),
    ('contractor_portal_access','created_at'),('contractor_portal_access','updated_at'),
    ('maintenance_forecasts','id'),('maintenance_forecasts','user_id'),('maintenance_forecasts','property_id'),
    ('maintenance_forecasts','summary'),('maintenance_forecasts','items'),('maintenance_forecasts','annual_budget'),
    ('maintenance_forecasts','generated_at'),
    ('reports','id'),('reports','user_id'),('reports','property_id'),('reports','property_address'),
    ('reports','title'),('reports','file_url'),('reports','health_score'),('reports','maintenance_count'),
    ('reports','repair_count'),('reports','appliance_count'),('reports','document_count'),('reports','photo_count'),
    ('reports','generated_at'),('reports','created_at'),
    ('admin_actions','id'),('admin_actions','actor_user_id'),('admin_actions','actor_email'),
    ('admin_actions','target_user_id'),('admin_actions','target_email'),('admin_actions','action'),
    ('admin_actions','metadata'),('admin_actions','created_at'),
    ('push_tokens','id'),('push_tokens','user_id'),('push_tokens','token'),('push_tokens','platform'),
    ('push_tokens','created_at'),('push_tokens','updated_at')
  ) AS v(table_name, column_name)
),
tables AS (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
),
columns AS (
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public'
),
table_summary AS (
  SELECT
    'table'::text AS object_type,
    e.table_name,
    NULL::text AS column_name,
    CASE WHEN t.table_name IS NOT NULL THEN '✓ Exists' ELSE '✗ Missing' END AS status,
    e.table_name = ANY(ARRAY[
      'pricing_plans','notification_broadcasts'
    ]) AS is_critical
  FROM expected_tables e
  LEFT JOIN tables t ON t.table_name = e.table_name
),
column_summary AS (
  SELECT
    'column'::text AS object_type,
    e.table_name,
    e.column_name,
    CASE
      WHEN t.table_name IS NULL THEN '✗ Missing (table absent)'
      WHEN c.column_name IS NOT NULL THEN '✓ Exists'
      ELSE '✗ Missing'
    END AS status,
    (e.table_name, e.column_name) IN (
      SELECT * FROM (VALUES
        ('documents','upload_date'),
        ('promo_codes','discount_type'),
        ('maintenance_items','user_id'),
        ('repairs','user_id'),
        ('appliances','user_id'),
        ('contractors','user_id'),
        ('user_roles','updated_at')
      ) AS critical_pairs(table_name, column_name)
    ) AS is_critical
  FROM expected_columns e
  LEFT JOIN tables t ON t.table_name = e.table_name
  LEFT JOIN columns c ON c.table_name = e.table_name AND c.column_name = e.column_name
)
SELECT
  'FINAL_SUMMARY' AS section,
  object_type,
  table_name,
  column_name,
  status,
  CASE WHEN is_critical THEN 'CRITICAL' ELSE '' END AS note
FROM (
  SELECT * FROM table_summary
  UNION ALL
  SELECT * FROM column_summary
) combined
ORDER BY
  CASE WHEN status LIKE '✗%' THEN 0 ELSE 1 END,
  object_type,
  table_name,
  column_name NULLS FIRST;
