-- ==========================================================
-- Migration: align database defaults with the application rules
-- Run this manually against the Supabase project (SQL Editor).
-- Safe to re-run (idempotent).
-- ==========================================================

-- New tasks are one-shot unless a recurrence is chosen (same default as the task form and API).
ALTER TABLE public.tasks ALTER COLUMN recurrence SET DEFAULT 'ONCE';

-- Sleep times are recorded explicitly (stored in UTC). A '23:00' / '07:00' column default was
-- read back as a UTC time and shifted for every non-UTC user; missing times now fall back to
-- the user's sleep target in the app, as unvalidated placeholders.
ALTER TABLE public.sleep_logs ALTER COLUMN bedtime DROP DEFAULT;
ALTER TABLE public.sleep_logs ALTER COLUMN wake_time DROP DEFAULT;

-- Calendar subscriptions: the app creates "cal-..." text ids and defaults to this color.
ALTER TABLE public.calendar_subscriptions ALTER COLUMN color SET DEFAULT '#3B82F6';
