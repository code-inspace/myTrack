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
  const isDemo = targetId === DEMO_USER.id;
  if (typeof window === "undefined") return isDemo ? generateDemoSeedTasks() : [];
  const key = TASKS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  const parsedMain = safeParseJson<Task[]>(stored, []);

  if (!isDemo) {
    const knownKeys = [
      TASKS_STORAGE_PREFIX + DEMO_USER.id,
      "mytrack_tasks_v1",
      "mytrack_tasks",
      "tasks",
    ];
    const taskMap = new Map<string, Task>();
    for (const t of parsedMain) {
      taskMap.set(t.id, t);
    }

    let foundExtra = false;
    for (const k of knownKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const extraTasks = safeParseJson<Task[]>(raw, []);
        for (const t of extraTasks) {
          if (t.id.startsWith("00000000-0000-0000-0000-")) continue;
          if (!taskMap.has(t.id)) {
            taskMap.set(t.id, { ...t, userId: targetId });
            foundExtra = true;
          }
        }
      }
    }

    const merged = Array.from(taskMap.values());
    if (foundExtra) {
      saveStoredTasks(merged, targetId);
    }
    return merged;
  }

  if (parsedMain.length === 0 && isDemo) {
    const seed = generateDemoSeedTasks(targetId);
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  return parsedMain;
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
  const parsedMain = safeParseJson<TaskCompletion[]>(stored, []);

  if (!isDemo) {
    const knownKeys = [
      COMPLETIONS_STORAGE_PREFIX + DEMO_USER.id,
      "mytrack_completions_v1",
      "mytrack_completions",
      "completions",
    ];
    const compMap = new Map<string, TaskCompletion>();
    for (const c of parsedMain) {
      compMap.set(`${c.taskId}_${c.date}`, c);
    }

    let foundExtra = false;
    for (const k of knownKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const extraComps = safeParseJson<TaskCompletion[]>(raw, []);
        for (const c of extraComps) {
          if (c.taskId?.startsWith("00000000-0000-0000-0000-")) continue;
          const mapKey = `${c.taskId}_${c.date}`;
          if (!compMap.has(mapKey)) {
            compMap.set(mapKey, { ...c, userId: targetId });
            foundExtra = true;
          }
        }
      }
    }

    const merged = Array.from(compMap.values());
    if (foundExtra) {
      saveStoredCompletions(merged, targetId);
    }
    return merged;
  }

  if (parsedMain.length === 0 && isDemo) {
    const seed = generateDemoSeedCompletions(targetId);
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  return parsedMain;
}

export function saveStoredCompletions(completions: TaskCompletion[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(completions));
}
