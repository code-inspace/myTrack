import { Task, TaskCompletion, TaskFormValues, LogCompletionValues } from "./types";
import { getTodayDateString } from "@/lib/dates";

const TASKS_STORAGE_KEY = "mytrack_tasks_v1";
const COMPLETIONS_STORAGE_KEY = "mytrack_completions_v1";

// Seed data initial réaliste en français
export const INITIAL_SEED_TASKS: Task[] = [
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

export const INITIAL_SEED_COMPLETIONS: TaskCompletion[] = [
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

export function getStoredTasks(): Task[] {
  if (typeof window === "undefined") return INITIAL_SEED_TASKS;
  const stored = localStorage.getItem(TASKS_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_TASKS));
    return INITIAL_SEED_TASKS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_SEED_TASKS;
  }
}

export function saveStoredTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

export function getStoredCompletions(): TaskCompletion[] {
  if (typeof window === "undefined") return INITIAL_SEED_COMPLETIONS;
  const stored = localStorage.getItem(COMPLETIONS_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_COMPLETIONS));
    return INITIAL_SEED_COMPLETIONS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_SEED_COMPLETIONS;
  }
}

export function saveStoredCompletions(completions: TaskCompletion[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
}
