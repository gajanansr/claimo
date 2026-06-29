-- ============================================================
-- Migration: Store the full geocoded address on saved locations
-- The location picker already reverse-geocodes a full address when
-- a pin is dropped; persist it so reports can show the full
-- location (not just the short label like "Office").
-- ============================================================

alter table public.user_locations
  add column if not exists address text;
