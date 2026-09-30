import { Task, TaskCompletion } from "../types";
import { getEffectiveUserId } from "./user";
import { TASKS_STORAGE_PREFIX, COMPLETIONS_STORAGE_PREFIX } from "./mappers";

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as unknown as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getStoredTasks(userId?: string): Task[] {
  if (typeof window === "undefined") return [];
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;

  let parsed = safeParseJson<Task[]>(localStorage.getItem(key), []);
  if (parsed.length === 0) {
    const fallback = localStorage.getItem("mytrack_cached_tasks") || localStorage.getItem(TASKS_STORAGE_PREFIX);
    if (fallback) {
      parsed = safeParseJson<Task[]>(fallback, []);
    }
  }

  return parsed.filter((t) => t && typeof t.id === "string" && !t.id.startsWith("00000000-0000-0000-0000-"));
}

export function saveStoredTasks(tasks: Task[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;
  const cleanTasks = (Array.isArray(tasks) ? tasks : []).filter((t) => t && typeof t.id === "string" && !t.id.startsWith("00000000-0000-0000-0000-"));
  const serialized = JSON.stringify(cleanTasks);
  try {
    localStorage.setItem(key, serialized);
    localStorage.setItem("mytrack_cached_tasks", serialized);
  } catch {}
}

export function getStoredCompletions(userId?: string): TaskCompletion[] {
  if (typeof window === "undefined") return [];
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  let parsed = safeParseJson<TaskCompletion[]>(localStorage.getItem(key), []);
  if (parsed.length === 0) {
    const fallback = localStorage.getItem("mytrack_cached_completions") || localStorage.getItem(COMPLETIONS_STORAGE_PREFIX);
    if (fallback) {
      parsed = safeParseJson<TaskCompletion[]>(fallback, []);
    }
  }

  return parsed.filter((c) => c && typeof c.taskId === "string" && !c.taskId.startsWith("00000000-0000-0000-0000-"));
}

export function saveStoredCompletions(completions: TaskCompletion[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  const cleanComps = (Array.isArray(completions) ? completions : []).filter((c) => c && typeof c.taskId === "string" && !c.taskId.startsWith("00000000-0000-0000-0000-"));
  const serialized = JSON.stringify(cleanComps);
  try {
    localStorage.setItem(key, serialized);
    localStorage.setItem("mytrack_cached_completions", serialized);
  } catch {}
}
