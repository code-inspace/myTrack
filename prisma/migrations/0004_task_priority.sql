-- ==========================================================
-- Migration: task priority (Normale / Urgente / Très urgente)
-- Run this manually against the Supabase project (SQL Editor).
-- Safe to re-run (idempotent).
-- ==========================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';
