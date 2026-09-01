-- ==========================================================
-- Migration: task_completions timing columns
-- Adds optional scheduled and actual timing columns to task_completions
-- Safe to re-run (all statements are idempotent).
-- ==========================================================

ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS scheduled_start_time TEXT;
ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS scheduled_end_time TEXT;
ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS actual_start_time TEXT;
ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS actual_end_time TEXT;
