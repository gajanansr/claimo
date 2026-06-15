-- ============================================================
-- Migration: Restrict services to Uber & Rapido only
-- Drop old check constraint, add new one
-- ============================================================

-- 1. Drop the old constraint
alter table public.receipts drop constraint if exists receipts_service_check;

-- 2. Add updated constraint
alter table public.receipts
  add constraint receipts_service_check
  check (service in ('uber', 'rapido'));

-- 3. Remove any stale data from other services (safety net)
delete from public.receipts where service not in ('uber', 'rapido');
