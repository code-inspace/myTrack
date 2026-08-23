import { Task, TaskCompletion, TaskFormValues, LogCompletionValues } from "./types";
import { getTodayDateString } from "@/lib/dates";
import { getStoredUserSession } from "@/features/auth/actions";

const TASKS_STORAGE_PREFIX = "mytrack_tasks_";
const COMPLETIONS_STORAGE_PREFIX = "mytrack_completions_";

// Données initiales spécifiques au compte demo@de.mo
export const INITIAL_DEMO_TASKS: Task[] = [
  {
    id: "task-seed-1",
    userId: "user-demo",
    title: "Entraînement matinal",
    description: "Étirements et circuit au poids du corps",
    category: "Fitness",
    startTime: "05:30",
    endTime: "06:00",
    recurrence: "DAILY",
    trackingType: "DURATION",
    targetValue: 30,
    unit: "min",
    isActive: true, // Tâche active pour correspondre au design
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task-seed-2",
    userId: "user-demo",
    title: "Pompes",
    description: "Séries quotidiennes pectoraux & bras",
    category: "Fitness",
    startTime: "05:30",
    endTime: "06:00",
    recurrence: "DAILY",
    trackingType: "NUMBER",
    targetValue: 50,
    unit: "reps",
    isActive: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task-seed-3",
    userId: "user-demo",
    title: "Lecture",
    description: "Atomic Habits & System design",
    category: "Learning",
    startTime: "05:30",
    endTime: "06:00",
    recurrence: "DAILY",
    trackingType: "NUMBER",
    targetValue: 20,
    unit: "pages",
    isActive: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task-seed-4",
    userId: "user-demo",
    title: "Session Deep Work",
    description: "Programmation ciblée sans distractions",
    category: "Productivity",
    startTime: "05:30",
    endTime: "06:00",
    recurrence: "DAILY",
    trackingType: "DURATION",
    targetValue: 120,
    unit: "min",
    isActive: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_DEMO_COMPLETIONS: TaskCompletion[] = [
  {
    id: "c-1",
    taskId: "task-seed-2",
    userId: "user-demo",
    date: getTodayDateString(),
    completed: true,
    value: 35,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function getEffectiveUserId(explicitUserId?: string): string {
  if (explicitUserId) return explicitUserId;
  const session = getStoredUserSession();
  return session?.id || "user-demo";
}

export function getStoredTasks(userId?: string): Task[] {
  if (typeof window === "undefined") return INITIAL_DEMO_TASKS;
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    // Si c'est le compte démo, charger les tâches de démo, sinon compte vierge = []
    const defaultData = targetId === "user-demo" ? INITIAL_DEMO_TASKS : [];
    localStorage.setItem(key, JSON.stringify(defaultData));
    return defaultData;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return targetId === "user-demo" ? INITIAL_DEMO_TASKS : [];
  }
}

export function saveStoredTasks(tasks: Task[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(tasks));
}

export function getStoredCompletions(userId?: string): TaskCompletion[] {
  if (typeof window === "undefined") return INITIAL_DEMO_COMPLETIONS;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    const defaultData = targetId === "user-demo" ? INITIAL_DEMO_COMPLETIONS : [];
    localStorage.setItem(key, JSON.stringify(defaultData));
    return defaultData;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return targetId === "user-demo" ? INITIAL_DEMO_COMPLETIONS : [];
  }
}

export function saveStoredCompletions(completions: TaskCompletion[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(completions));
}
