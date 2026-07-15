# Migration 021 — Codebase Audit & Verification Report

**Run in Supabase:** `supabase/migrations/021_true_schema_reconciliation.sql`

---

## Services audit — tables & columns covered

| Service | Table | Columns used | In 021 |
|---------|-------|--------------|--------|
| `maintenanceService` | `maintenance_items` | id, user_id, property_id, title, category, last_completed, next_due, status, notes, recurring, interval_days, priority, created_at | ✅ |
| `repairService` | `repairs` | id, user_id, property_id, title, date, cost, contractor, category, notes, photo_urls, receipt_url, warranty_expires | ✅ |
| `applianceService` | `appliances` | id, user_id, property_id, name, category, brand, model, serial, serial_number, install_date, purchase_date, purchase_price, expected_life_years, warranty_expires, warranty_expiration, last_service, next_service, condition, notes, photo_url, manual_url, receipt_url | ✅ |
| `vaultService` | `documents`, `receipts`, `warranties` | user_id, property_id, title, file_url, file_type, file_size, **upload_date**, expires_date, notes, tags, category, created_at | ✅ |
| `vaultService` | `contractors` | user_id, property_id, name, trade, phone, email, website, rating, notes, last_used, license_number | ✅ |
| `vaultService` | `photos` | user_id, property_id, file_url, caption, date, category, created_at | ✅ |
| `propertyService` | `properties` | user_id, nickname, address, street_address, property_name, property_type, city, state, zip, type, year_built, square_feet, bedrooms, bathrooms, purchase_price, estimated_value, value, purchase_date, photo_url, image_url, is_selected, is_primary, is_active | ✅ |
| `scoreService` | `property_scores` | user_id, property_id, overall, maintenance, appliances, repairs, warranty, inspections, label, updated_at | ✅ |
| `pricingService` / `adminService` | `pricing_plans` | plan_key, **name**, monthly_price, yearly_price, description, features, is_active, sort_order, created_at, updated_at | ✅ |
| `promoService` / `adminService` | `promo_codes` | code, description, **discount_type**, discount_value, plan_scope, max_uses, used_count, is_active, expires_at, created_at, updated_at | ✅ |
| `notificationService` | `notification_broadcasts` | title, body, sent_by, is_active, created_at | ✅ |
| `notificationService` | `user_broadcast_reads` | user_id, broadcast_id, read_at | ✅ |
| `adminService` / `AuthContext` | `user_roles` | user_id, role, **updated_at**, created_at | ✅ |
| `adminService` / `entitlementWrite` | `user_entitlements` | user_id, entitlement, granted_by, created_at | ✅ |
| `AuthContext` | `profiles` | id, email, name, phone, avatar_uri, plan, notifications_enabled, maintenance_reminders, warranty_alerts, appliance_reminders, subscription_reminders, admin_broadcasts, email_digest, created_at, updated_at | ✅ |

### Additional tables referenced by app (not in user’s reconcile list but exist in repo)

| Table | Covered in 021 |
|-------|----------------|
| `photos` | ✅ Phase 2 + 3 + RLS |
| `reports` | ⚠️ Not in Phase 2 |
| `subscriptions` | ⚠️ Not in Phase 2 |
| `push_tokens` | ⚠️ Not in Phase 2 |

> User requested specific 16 tables; 021 fully reconciles those 16 + `user_broadcast_reads` + `photos` (vault).

---

## Known failures → fix mapping

| Production error | 021 fix |
|------------------|---------|
| `user_roles.updated_at` missing | Phase 3 `hw_add_column` + Phase 5 `hw_ensure_timestamps` |
| Duplicate `user_roles.user_id` | Phase 5 dedup before Phase 6 unique index |
| `pricing_plans.name` missing | Phase 3 |
| `documents.upload_date` missing | Phase 3 |
| `promo_codes.discount_type` missing | Phase 3 + Phase 4 rename/copy from `type` |
| RLS INSERT blocked | Phase 9 explicit `{table}_insert_own` policies |

---

## Objects created or modified

### Functions
`hw_table_exists`, `hw_column_exists`, `hw_add_column`, `hw_ensure_timestamps`, `set_updated_at`, `founder_emails`, `is_founder_email`, `is_founder_user`, `is_super_admin`, `ensure_founder_full_access`, `bootstrap_owner_admin`, `delete_own_account`, `validate_promo_code`, `redeem_promo_code`, `hw_apply_user_rls`, `protect_founder_profile_delete`, `protect_founder_profile_update`, `protect_founder_user_roles`, `ensure_founder_user_roles`, `protect_founder_entitlements`

### Indexes
`user_roles_user_id_uidx`, `user_entitlements_user_entitlement_uidx`, `pricing_plans_plan_key_uidx`, `promo_codes_code_uidx`, `property_scores_property_id_uidx`

### Triggers
`{table}_updated_at` for 13 tables (only when `updated_at` exists); founder protection triggers on `profiles`, `user_roles`, `user_entitlements`

### RLS policies (rebuilt)
Per-table SELECT/INSERT/UPDATE/DELETE on user-owned tables; admin policies on `pricing_plans`, `promo_codes`, `notification_broadcasts`; profiles/user_roles/user_entitlements special policies

### Founder protection
- Emails: `horse0140@gmail.com`, `hdmccoy180@gmail.com`
- Permanent: `super_admin`, `owner_access`, `premium`, `landlord`, `realtor`
- Cannot delete, downgrade plan to free, revoke role, or delete entitlements

---

## Post-apply verification

Run the commented queries at the bottom of `021_true_schema_reconciliation.sql`.
