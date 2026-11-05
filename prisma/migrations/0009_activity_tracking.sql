-- ==========================================================
-- Migration: automatic activity tracking (Claude Code hooks, app heartbeats)
-- Run this against the Supabase project (SQL Editor).
-- Safe to re-run (all statements are idempotent).
-- ==========================================================

-- A "source" is something that pings MyTrack: a folder opened in Claude Code, or an app.
-- It is mapped to a project; the task that receives the minutes is created on the first ping.
CREATE TABLE IF NOT EXISTS public.activity_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,                       -- e.g. "letscook"
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,   -- false = ignored, pings are dropped
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_activity_source UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_activity_sources_user_id ON public.activity_sources(user_id);

-- One row per uninterrupted stretch of work. Minutes are credited to task_completions as pings
-- arrive, so a session that is never explicitly closed loses nothing.
CREATE TABLE IF NOT EXISTS public.activity_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL,
    origin TEXT NOT NULL,                    -- "claude-code" | "web"
    started_at TIMESTAMPTZ NOT NULL,
    last_ping_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    seconds INTEGER DEFAULT 0 NOT NULL,
    credited_minutes INTEGER DEFAULT 0 NOT NULL,
    ended_by TEXT,                           -- "event" | "idle"
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_sessions_open
    ON public.activity_sessions(user_id, source_key) WHERE ended_at IS NULL;

ALTER TABLE public.activity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage their own activity sources"
        ON public.activity_sources FOR ALL
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can read their own activity sessions"
        ON public.activity_sessions FOR SELECT
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
