import { Project, ProjectColumn } from "./types";
import { getEffectiveUserId } from "@/features/tasks/actions";
import { createClient } from "@/utils/supabase/client";

const PROJECTS_STORAGE_PREFIX = "mytrack_projects_";

function mapDbProjectToModel(row: any): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color || "#D4F63D",
    columns: Array.isArray(row.columns) ? row.columns : [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function getStoredProjects(userId?: string): Project[] {
  const targetId = getEffectiveUserId(userId);
  if (typeof window === "undefined") return [];
  const key = PROJECTS_STORAGE_PREFIX + targetId;
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredProjects(projects: Project[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  localStorage.setItem(PROJECTS_STORAGE_PREFIX + targetId, JSON.stringify(projects));
}

export async function fetchProjects(userId?: string): Promise<Project[]> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map(mapDbProjectToModel);
      saveStoredProjects(mapped, targetId);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchProjects error:", err);
  }

  return getStoredProjects(targetId);
}

export async function createDbProject(
  name: string,
  color: string,
  columns: ProjectColumn[],
  userId?: string
): Promise<Project> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    const { data, error } = await supabase
      .from("projects")
      .insert([{ user_id: targetId, name, color, columns }])
      .select()
      .single();

    if (!error && data) {
      const created = mapDbProjectToModel(data);
      const current = getStoredProjects(targetId);
      saveStoredProjects([created, ...current], targetId);
      return created;
    }
  } catch (err) {
    console.warn("Supabase createDbProject error:", err);
  }

  const nowIso = new Date().toISOString();
  const createdLocal: Project = {
    id: "project-" + Date.now(),
    userId: targetId!,
    name,
    color,
    columns,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const current = getStoredProjects(targetId);
  saveStoredProjects([createdLocal, ...current], targetId);
  return createdLocal;
}

export async function updateDbProject(
  projectId: string,
  updates: { name?: string; color?: string; columns?: ProjectColumn[] },
  userId?: string
): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const nowIso = new Date().toISOString();

  try {
    await supabase
      .from("projects")
      .update({ ...updates, updated_at: nowIso })
      .eq("id", projectId);
  } catch (err) {
    console.warn("Supabase updateDbProject error:", err);
  }

  const current = getStoredProjects(targetId);
  saveStoredProjects(
    current.map((p) => (p.id === projectId ? { ...p, ...updates, updatedAt: nowIso } : p)),
    targetId
  );
}

export async function deleteDbProject(projectId: string, userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    await supabase.from("projects").delete().eq("id", projectId);
  } catch (err) {
    console.warn("Supabase deleteDbProject error:", err);
  }

  const current = getStoredProjects(targetId);
  saveStoredProjects(current.filter((p) => p.id !== projectId), targetId);
}
