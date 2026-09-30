import { Project, ProjectColumn } from "./types";
import { getEffectiveUserId } from "@/features/tasks/actions";
import { createClient } from "@/utils/supabase/client";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";

const PROJECTS_STORAGE_PREFIX = "mytrack_projects_";

export function mapDbProjectToModel(row: any): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color || "#D4F63D",
    columns: Array.isArray(row.columns) ? row.columns : [],
    categories: Array.isArray(row.categories) ? row.categories : [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function mapDbProjectToModelAsync(row: any): Promise<Project> {
  let name = row.name;
  if (name && isEncrypted(name)) {
    name = await decryptText(name);
  }
  return {
    ...mapDbProjectToModel(row),
    name,
  };
}

export function getStoredProjects(userId?: string): Project[] {
  if (typeof window === "undefined") return [];
  const targetId = getEffectiveUserId(userId);
  const key = PROJECTS_STORAGE_PREFIX + targetId;

  let stored = localStorage.getItem(key);
  if (!stored) {
    stored = localStorage.getItem("mytrack_cached_projects") || localStorage.getItem(PROJECTS_STORAGE_PREFIX);
  }
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((p) => p && typeof p.id === "string" && !p.id.startsWith("00000000-0000-0000-0000-"));
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredProjects(projects: Project[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const cleanProjects = (Array.isArray(projects) ? projects : []).filter(
    (p) => p && typeof p.id === "string" && !p.id.startsWith("00000000-0000-0000-0000-")
  );
  const serialized = JSON.stringify(cleanProjects);
  try {
    localStorage.setItem(PROJECTS_STORAGE_PREFIX + targetId, serialized);
    localStorage.setItem("mytrack_cached_projects", serialized);
  } catch {}
}

export async function fetchProjects(userId?: string): Promise<Project[]> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const finalUserId = targetId || "";

  // 1. Direct Supabase client query (0 Serverless CPU, instant client read)
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped = await Promise.all(data.map(mapDbProjectToModelAsync));
      saveStoredProjects(mapped, targetId);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchProjects error:", err);
  }

  // 2. Fallback to server API route if needed
  try {
    const res = await fetch(`/api/projects?userId=${encodeURIComponent(finalUserId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.projects)) {
        saveStoredProjects(json.projects, targetId);
        return json.projects;
      }
    }
  } catch (apiErr) {
    console.warn("fetchProjects API route error, falling back to local storage:", apiErr);
  }

  return getStoredProjects(targetId);
}

export async function createDbProject(
  name: string,
  color: string,
  columns: ProjectColumn[],
  userId?: string,
  categories?: string[]
): Promise<Project> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const projectCategories = categories || [];

  // 1. Try server API route
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetId,
        name,
        color,
        columns,
        categories: projectCategories,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.project) {
        const current = getStoredProjects(targetId);
        saveStoredProjects([json.project, ...current.filter((p) => p.id !== json.project.id)], targetId);
        return json.project;
      }
    }
  } catch (apiErr) {
    console.warn("createDbProject API route error, falling back to client:", apiErr);
  }

  // 2. Fallback to Supabase client
  try {
    const encryptedName = await encryptText(name);
    const { data, error } = await supabase
      .from("projects")
      .insert([{ user_id: targetId, name: encryptedName, color, columns, categories: projectCategories }])
      .select()
      .single();

    if (!error && data) {
      const created = await mapDbProjectToModelAsync(data);
      const current = getStoredProjects(targetId);
      saveStoredProjects([created, ...current.filter((p) => p.id !== created.id)], targetId);
      return created;
    }
  } catch (err) {
    console.warn("Supabase createDbProject error:", err);
  }

  // 3. Fallback to local
  const nowIso = new Date().toISOString();
  const createdLocal: Project = {
    id: "project-" + Date.now(),
    userId: targetId!,
    name,
    color,
    columns,
    categories: projectCategories,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const current = getStoredProjects(targetId);
  saveStoredProjects([createdLocal, ...current], targetId);
  return createdLocal;
}

export async function updateDbProject(
  projectId: string,
  updates: { name?: string; color?: string; columns?: ProjectColumn[]; categories?: string[] },
  userId?: string
): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const nowIso = new Date().toISOString();
  const current = getStoredProjects(targetId);
  saveStoredProjects(
    current.map((p) => (p.id === projectId ? { ...p, ...updates, updatedAt: nowIso } : p)),
    targetId
  );

  // 1. Try server API route
  try {
    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: projectId,
        userId: targetId,
        ...updates,
      }),
    });
    if (res.ok) return;
  } catch (apiErr) {
    console.warn("updateDbProject API route error, falling back to client:", apiErr);
  }

  // 2. Fallback to Supabase client
  const dbUpdates: any = { ...updates, updated_at: nowIso };
  if (updates.name !== undefined) {
    dbUpdates.name = await encryptText(updates.name);
  }

  try {
    await supabase
      .from("projects")
      .update(dbUpdates)
      .eq("id", projectId);
  } catch (err) {
    console.warn("Supabase updateDbProject error:", err);
  }
}

export async function deleteDbProject(projectId: string, userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const current = getStoredProjects(targetId);
  saveStoredProjects(current.filter((p) => p.id !== projectId), targetId);

  const finalUserId = targetId || "";

  // 1. Try server API route
  try {
    const res = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(finalUserId)}`, {
      method: "DELETE",
    });
    if (res.ok) return;
  } catch (apiErr) {
    console.warn("deleteDbProject API route error, falling back to client:", apiErr);
  }

  // 2. Fallback to Supabase client
  try {
    await supabase.from("projects").delete().eq("id", projectId);
  } catch (err) {
    console.warn("Supabase deleteDbProject error:", err);
  }
}
