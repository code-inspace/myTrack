import { Task, TaskCompletion } from "../types";
import { getEffectiveUserId } from "./user";
import { TASKS_STORAGE_PREFIX, COMPLETIONS_STORAGE_PREFIX } from "./mappers";
import { DEMO_USER } from "@/features/auth/actions";
import { generateDemoSeedTasks, generateDemoSeedCompletions } from "../demoSeed";

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
  const targetId = getEffectiveUserId(userId);
  if (typeof window === "undefined") return [];
  const key = TASKS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  const parsed = safeParseJson<Task[]>(stored, []);
  return parsed.filter((t) => !t.id.startsWith("00000000-0000-0000-0000-"));
}

export function saveStoredTasks(tasks: Task[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;
  const cleanTasks = tasks.filter((t) => !t.id.startsWith("00000000-0000-0000-0000-"));
  localStorage.setItem(key, JSON.stringify(cleanTasks));
}

export function getStoredCompletions(userId?: string): TaskCompletion[] {
  const targetId = getEffectiveUserId(userId);
  if (typeof window === "undefined") return [];
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  const parsed = safeParseJson<TaskCompletion[]>(stored, []);
  return parsed.filter((c) => !c.taskId?.startsWith("00000000-0000-0000-0000-"));
}

export function saveStoredCompletions(completions: TaskCompletion[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  const cleanComps = completions.filter((c) => !c.taskId?.startsWith("00000000-0000-0000-0000-"));
  localStorage.setItem(key, JSON.stringify(cleanComps));
}
