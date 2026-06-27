-- ============================================================
-- Migration: Report date ranges
-- Reports can now cover an arbitrary start..end date range, not
-- just a single calendar month. month/year are still populated
-- (derived from start_date) for display + ordering continuity.
-- ============================================================

-- 1. Add the range columns (nullable; legacy rows keep month/year only)
alter table public.reports
  add column if not exists start_date date,
  add column if not exists end_date   date;

-- 2. Drop the one-report-per-month uniqueness so multiple custom-range
--    reports can exist in the same month.
alter table public.reports
  drop constraint if exists reports_user_id_month_year_key;
