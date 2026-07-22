-- ============================================================================
-- 029 — Maintenance completion: archived flag
--
-- Completion outcomes:
--   history   → status Completed, archived false
--   reschedule → status from next_due, archived false
--   archive   → status Completed, archived true
--
-- Status CHECK remains Upcoming | Due Soon | Overdue | Completed.
-- ============================================================================

alter table public.maintenance_items
  add column if not exists archived boolean not null default false;

comment on column public.maintenance_items.archived is
  'True when the user chose Complete and archive; hidden from active Upcoming/Overdue lists.';
