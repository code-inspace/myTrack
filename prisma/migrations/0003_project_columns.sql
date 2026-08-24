-- ==========================================================
-- Migration: customizable Kanban columns per project
-- Run this manually against the Supabase project (SQL Editor).
-- Safe to re-run (idempotent).
-- ==========================================================

-- Stores an ordered array of {id, label} objects, e.g.
-- [{"id":"TODO","label":"À faire"},{"id":"col-172...","label":"Revue"}]
-- NULL means "use the app's default 4 columns" (backward-compatible with existing projects).
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS columns JSONB;
