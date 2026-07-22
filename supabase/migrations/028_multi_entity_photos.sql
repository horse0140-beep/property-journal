-- ============================================================================
-- 028 — Multi-photo support for appliances and maintenance_items
--
-- Schema audit (migrations 003 / 013 / 020 / 021):
--   repairs.photo_urls          text[]  — already exists (multi-photo OK)
--   appliances.photo_url        text    — singular only; cannot store multiple
--   maintenance_items           — no photo_url / photo_urls columns at all
--
-- This migration adds photo_urls arrays and keeps appliances.photo_url as the
-- first-image mirror for older readers / optional-column fallbacks.
-- ============================================================================

-- ── appliances: multi-photo array + backfill from singular photo_url ─────────
alter table public.appliances
  add column if not exists photo_urls text[] default '{}';

update public.appliances
set photo_urls = array[photo_url]
where photo_url is not null
  and btrim(photo_url) <> ''
  and (
    photo_urls is null
    or cardinality(photo_urls) = 0
  );

-- ── maintenance_items: multi-photo array ────────────────────────────────────
alter table public.maintenance_items
  add column if not exists photo_urls text[] default '{}';
