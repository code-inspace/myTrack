-- Migration: Add tag and project_category to tasks, and categories to projects
-- Replaces historical 'category' with 'tag' while keeping backward compatibility

-- 1. Add tag column to tasks
ALTER TABLE IF EXISTS public.tasks 
ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'General';

-- 2. Populate tag from existing category column where available
UPDATE public.tasks 
SET tag = category 
WHERE (tag IS NULL OR tag = 'General') AND category IS NOT NULL AND category != 'General';

-- 3. Add project_category column to tasks
ALTER TABLE IF EXISTS public.tasks 
ADD COLUMN IF NOT EXISTS project_category TEXT;

-- 4. Add categories JSONB column to projects
ALTER TABLE IF EXISTS public.projects 
ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb;
