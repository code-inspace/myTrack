import { Task, TaskCompletion } from "../types";
import { getEffectiveUserId } from "./user";
import { TASKS_STORAGE_PREFIX, COMPLETIONS_STORAGE_PREFIX } from "./mappers";
import { DEMO_USER } from "@/features/auth/actions";
import { generateDemoSeedTasks, generateDemoSeedCompletions } from "../demoSeed";

export function getStoredTasks(userId?: string): Task[] {
  const targetId = getEffectiveUserId(userId);
  const isDemo = targetId === DEMO_USER.id;
  if (typeof window === "undefined") return isDemo ? generateDemoSeedTasks() : [];
  const key = TASKS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    if (isDemo) {
      const seed = generateDemoSeedTasks(targetId);
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0 && isDemo) {
        const seed = generateDemoSeedTasks(targetId);
        localStorage.setItem(key, JSON.stringify(seed));
        return seed;
      }
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredTasks(tasks: Task[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(tasks));
}

export function getStoredCompletions(userId?: string): TaskCompletion[] {
  const targetId = getEffectiveUserId(userId);
  const isDemo = targetId === DEMO_USER.id;
  if (typeof window === "undefined") return isDemo ? generateDemoSeedCompletions() : [];
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    if (isDemo) {
      const seed = generateDemoSeedCompletions(targetId);
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0 && isDemo) {
        const seed = generateDemoSeedCompletions(targetId);
        localStorage.setItem(key, JSON.stringify(seed));
        return seed;
      }
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredCompletions(completions: TaskCompletion[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(completions));
}
