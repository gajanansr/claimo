-- ============================================================
-- Migration: Add ride_id for reliable per-ride deduplication
-- Rapido (and similar) receipts carry a globally unique ride ID
-- (e.g. "RD17824462113883087"). Keying dedup on it removes the
-- lossy (amount + date) heuristic that produced duplicate rows
-- when the same ride arrives in both an individual and a bulk
-- receipt email.
-- ============================================================

-- 1. Store the provider's unique ride identifier
alter table public.receipts
  add column if not exists ride_id text;

-- 2. One row per (user, ride). Partial unique index so rows without
--    a parsed ride_id (legacy/other providers) are unaffected.
create unique index if not exists receipts_user_ride_id_uniq
  on public.receipts (user_id, ride_id)
  where ride_id is not null;

create index if not exists receipts_ride_id_idx
  on public.receipts (ride_id);
