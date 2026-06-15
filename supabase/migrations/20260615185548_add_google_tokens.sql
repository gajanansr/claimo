-- ============================================================
-- Migration: Add Google Tokens to Profiles
-- ============================================================

alter table public.profiles
add column if not exists google_access_token text,
add column if not exists google_refresh_token text,
add column if not exists token_expires_at timestamptz;
