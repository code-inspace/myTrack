-- ==========================================================
-- Migration: habit reorder persistence + Projects/Kanban
-- Run this manually against the Supabase project (SQL Editor).
-- Safe to re-run (all statements are idempotent).
-- ==========================================================

-- Habit reorder persistence (drag-and-drop priority)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#D4F63D',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage their own projects"
        ON public.projects FOR ALL
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task <-> Project linkage + Kanban column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'TODO';
