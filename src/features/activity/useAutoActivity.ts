"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useProjects } from "@/features/projects/hooks";
import { isAutoCreatedProject, isSessionLive, type ActivityOrigin } from "@/lib/activity/sessions";

export interface AutoSource {
  id: string;
  key: string;
  projectId: string | null;
  enabled: boolean;
}
export interface LiveAutoSession {
  key: string;
  origin: ActivityOrigin;
  projectId: string | null;
}

/**
 * Time tracked on its own (Claude Code hooks, app heartbeats): which sources exist, which are
 * working right now, and which are not attached to any domain. Missing tables (migration not
 * applied) just mean "nothing automatic".
 */
export function useAutoActivity() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const { projects } = useProjects();

  const { data } = useQuery({
    queryKey: ["activity-overview", userId],
    enabled: !!userId,
    retry: false,
    refetchInterval: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const [sources, sessions] = await Promise.all([
        supabase.from("activity_sources").select("id, key, project_id, enabled").order("key"),
        supabase
          .from("activity_sessions")
          .select("source_key, origin, last_ping_at")
          .is("ended_at", null)
          .order("last_ping_at", { ascending: false })
          .limit(20),
      ]);
      if (sources.error) return { sources: [], sessions: [] };
      return { sources: sources.data || [], sessions: sessions.error ? [] : sessions.data || [] };
    },
  });

  return useMemo(() => {
    const now = new Date();
    const sources: AutoSource[] = ((data?.sources || []) as Array<{ id: string; key: string; project_id: string | null; enabled: boolean }>).map((s) => ({
      id: s.id,
      key: s.key,
      projectId: s.project_id ?? null,
      enabled: s.enabled,
    }));
    const byKey = new Map(sources.map((s) => [s.key, s]));
    const live: LiveAutoSession[] = [];
    const seen = new Set<string>();
    for (const row of (data?.sessions || []) as Array<{ source_key: string; origin: string; last_ping_at: string }>) {
      const key = row.source_key;
      const origin = row.origin as ActivityOrigin;
      const source = byKey.get(key);
      if (seen.has(key) || !source?.enabled) continue;
      if (!isSessionLive(new Date(row.last_ping_at), origin, now)) continue;
      seen.add(key);
      live.push({ key, origin, projectId: source.projectId });
    }
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const unattached = sources.filter(
      (s) => s.enabled && (!s.projectId || isAutoCreatedProject(s.key, projectName.get(s.projectId))),
    );
    const sourceProjectIds = new Set(sources.map((s) => s.projectId).filter((id): id is string => !!id));
    return { sources, live, unattached, sourceProjectIds, projectName };
  }, [data, projects]);
}
