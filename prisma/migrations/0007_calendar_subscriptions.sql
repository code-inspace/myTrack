-- ==========================================================
-- Migration: Encrypted Calendar Subscriptions Table
-- Run this against the Supabase project (SQL Editor).
-- Safe to re-run (all statements are idempotent).
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.calendar_subscriptions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL, -- Encrypted with AES-256-GCM (enc:v1:...)
    color TEXT DEFAULT '#3B82F6' NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    username TEXT, -- Encrypted with AES-256-GCM
    password TEXT, -- Encrypted with AES-256-GCM
    last_synced_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_user_id ON public.calendar_subscriptions(user_id);

ALTER TABLE public.calendar_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage their own calendar subscriptions"
        ON public.calendar_subscriptions FOR ALL
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
