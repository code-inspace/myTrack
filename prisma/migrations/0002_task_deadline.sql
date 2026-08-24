-- ==========================================================
-- Migration: task deadline field
-- Run this manually against the Supabase project (SQL Editor).
-- Safe to re-run (idempotent).
-- ==========================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deadline TEXT;
