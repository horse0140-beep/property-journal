# Property Journal Schema Audit

Generated from full codebase scan of `supabase.from()` / `.upsert()` usage vs `supabase/migrations/`.

## Tables expected by code

| Table | Primary services | RLS expected |
|-------|------------------|--------------|
| `profiles` | AuthContext | user owns row (`id`) |
| `user_roles` | adminService, AuthContext | user read own; admin manage |
| `user_entitlements` | adminService, promoService | user read own; admin manage |
| `pricing_plans` | pricingService, adminService | public read active; admin manage |
| `promo_codes` | promoService, adminService | admin manage |
| `subscriptions` | subscriptionService, adminService | user read own; admin manage |
| `support_tickets` | supportService, adminService | user own; admin all |
| `properties` | propertyService | `auth.uid() = user_id` CRUD |
| `maintenance_items` | maintenanceService | `auth.uid() = user_id` CRUD |
| `repairs` | repairService | `auth.uid() = user_id` CRUD |
| `appliances` | applianceService | `auth.uid() = user_id` CRUD |
| `contractors` | vaultService | `auth.uid() = user_id` CRUD |
| `paint_colors` | vaultService | `auth.uid() = user_id` CRUD |
| `documents` | vaultService | `auth.uid() = user_id` CRUD |
| `receipts` | vaultService | `auth.uid() = user_id` CRUD |
| `warranties` | vaultService | `auth.uid() = user_id` CRUD |
| `photos` | vaultService | `auth.uid() = user_id` CRUD |
| `property_scores` | scoreService | `auth.uid() = user_id` CRUD |
| `property_shares` | sharingService | user own |
| `contractor_portal_access` | contractorPortalService | user own |
| `maintenance_forecasts` | forecastService | user own |
| `stripe_customers` | stripeService | user own |
| `reports` | reportService | user own |
| `push_tokens` | pushService | user own |
| `notification_broadcasts` | notificationService | auth read active; admin manage |
| `user_broadcast_reads` | notificationService | user own |

## Columns (high-signal)

### documents
`id`, `user_id`, `property_id`, `title`, `category`, `file_url`, `file_type`, `file_size`, `upload_date`, `expires_date`, `notes`, `tags[]`

### promo_codes
`code` (unique), `discount_type`, `discount_value`, `plan_scope`, `max_uses`, `used_count`, `is_active`, `expires_at`

### user_entitlements
`user_id`, `entitlement`, `granted_by` — unique `(user_id, entitlement)`

### pricing_plans
`plan_key` (unique), `name`, `monthly_price`, `yearly_price`, `features[]`, `is_active`, `sort_order`

### notification_broadcasts
`title`, `body`, `sent_by`, `is_active`, `created_at`

## Unique constraints / ON CONFLICT

| Table | Conflict target | Migration |
|-------|-----------------|-----------|
| `user_roles` | `user_id` | 001 + 016 index |
| `user_entitlements` | `user_id,entitlement` | 007 + 016 index |
| `push_tokens` | `user_id,token` | 005 + 016 index |
| `property_scores` | `property_id` | 003/014 + 016 index |
| `stripe_customers` | `user_id` | 002 + 016 index |
| `maintenance_forecasts` | `user_id,property_id` | 002 + 016 index |
| `pricing_plans` | `plan_key` | 001 + 016 index |
| `promo_codes` | `code` | 001 + 016 index |
| `user_broadcast_reads` | `user_id,broadcast_id` | 009 PK |

## Apply order

Run **`021_true_schema_reconciliation.sql`** on production Supabase SQL Editor.

This strictly idempotent migration supersedes 020 and safely reconciles databases from migrations 000–020.

See **`docs/MIGRATION_021_VERIFICATION_REPORT.md`** for the codebase audit and verification queries.

## Protected founder accounts

- `horse0140@gmail.com`
- `hdmccoy180@gmail.com`

Both retain permanent `super_admin`, `owner_access`, and full plan entitlements via `ensure_founder_full_access()`.

See **`docs/PRODUCTION_READINESS_REPORT.md`** for the full audit.
