-- Migration: Add Multi-User Project Sharing & Encryption Support
-- Description: Creates project_members table with RLS and adds sharing capabilities.

-- 1. Project Members Table
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member' | 'viewer'
  encrypted_key TEXT, -- Encrypted project symmetric key (DEK) for this member
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);

-- 3. Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for project_members
DROP POLICY IF EXISTS "Users can view memberships of their projects" ON public.project_members;
CREATE POLICY "Users can view memberships of their projects"
ON public.project_members FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR project_id IN (
    SELECT project_id FROM public.project_members WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;
CREATE POLICY "Project owners can manage members"
ON public.project_members FOR ALL
TO authenticated
USING (
  project_id IN (
    SELECT p.id FROM public.projects p WHERE p.user_id = (SELECT auth.uid())
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = (SELECT auth.uid()) AND pm.role = 'owner'
  )
)
WITH CHECK (
  project_id IN (
    SELECT p.id FROM public.projects p WHERE p.user_id = (SELECT auth.uid())
    UNION
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = (SELECT auth.uid()) AND pm.role = 'owner'
  )
);

-- 5. Updated RLS Policies on tasks for shared projects
DROP POLICY IF EXISTS "Users can view tasks in shared projects" ON public.tasks;
CREATE POLICY "Users can view tasks in shared projects"
ON public.tasks FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR project_id IN (
    SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = (SELECT auth.uid())
  )
);

