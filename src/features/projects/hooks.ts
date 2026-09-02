"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project, ProjectColumn } from "./types";
import { fetchProjects, createDbProject, updateDbProject, deleteDbProject, getStoredProjects } from "./actions";
import { useAuth } from "@/providers/AuthProvider";

export function useProjects() {
  const { user } = useAuth();
  const userId = user?.id || "";

  const { data: projects = getStoredProjects(userId) } = useQuery({
    queryKey: ["projects", userId],
    queryFn: async () => fetchProjects(userId),
    placeholderData: () => getStoredProjects(userId),
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
  });

  return { projects };
}

export function useProjectMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "";

  const createProject = useMutation({
    mutationFn: async ({
      name,
      color,
      columns,
      categories,
    }: {
      name: string;
      color: string;
      columns: ProjectColumn[];
      categories?: string[];
    }) => createDbProject(name, color, columns, userId, categories),
    onSuccess: (newProject) => {
      queryClient.setQueryData<Project[]>(["projects", userId], (old = []) => [newProject, ...old]);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({
      projectId,
      updates,
    }: {
      projectId: string;
      updates: { name?: string; color?: string; columns?: ProjectColumn[]; categories?: string[] };
    }) => updateDbProject(projectId, updates, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => deleteDbProject(projectId, userId),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<Project[]>(["projects", userId], (old = []) =>
        old.filter((p) => p.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return { createProject, updateProject, deleteProject };
}
