-- ==========================================================
-- Migration: sleep naps (daytime rests logged via "Je me couche /
-- réveille maintenant" outside the night window)
-- Run this manually against the Supabase project (SQL Editor).
-- Safe to re-run (idempotent).
-- ==========================================================

ALTER TABLE public.sleep_logs ADD COLUMN IF NOT EXISTS naps JSONB DEFAULT '[]'::jsonb;
