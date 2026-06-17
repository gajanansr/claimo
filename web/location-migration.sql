-- ============================================================
-- Claimo: Office Location Categorization — Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add lat/lng and location_tag columns to receipts
ALTER TABLE receipts 
  ADD COLUMN IF NOT EXISTS from_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS from_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS to_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS to_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_tag TEXT;

-- Create user_locations table
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  color TEXT DEFAULT '#10b981',
  emoji TEXT DEFAULT '📍',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only manage their own locations
CREATE POLICY "Users manage own locations" ON user_locations
  FOR ALL USING (auth.uid() = user_id);
