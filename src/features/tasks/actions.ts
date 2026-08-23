import { Task, TaskCompletion, TaskFormValues, LogCompletionValues } from "./types";
import { getTodayDateString } from "@/lib/dates";
import { getStoredUserSession, DEMO_USER } from "@/features/auth/actions";
import { createClient } from "@/utils/supabase/client";

const TASKS_STORAGE_PREFIX = "mytrack_tasks_";
const COMPLETIONS_STORAGE_PREFIX = "mytrack_completions_";

export function getEffectiveUserId(explicitUserId?: string): string {
  if (explicitUserId) return explicitUserId;
  const session = getStoredUserSession();
  return session?.id || DEMO_USER.id;
}

// Convert Supabase snake_case task row to camelCase Task
function mapDbTaskToModel(row: any): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || null,
    category: row.category || "General",
    startTime: row.start_time || null,
    endTime: row.end_time || null,
    recurrence: row.recurrence,
    recurrenceConfig: row.recurrence_config || null,
    trackingType: row.tracking_type,
    targetValue: row.target_value ? parseFloat(row.target_value) : null,
    unit: row.unit || null,
    isActive: Boolean(row.is_active),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// Convert Supabase snake_case completion row to camelCase TaskCompletion
function mapDbCompletionToModel(row: any): TaskCompletion {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    date: row.date,
    completed: Boolean(row.completed),
    value: row.value !== null && row.value !== undefined ? parseFloat(row.value) : null,
    duration: row.duration || null,
    notes: row.notes || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function fetchTasks(userId?: string): Promise<Task[]> {
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map(mapDbTaskToModel);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(mapped));
      }
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchTasks fallback to local storage:", err);
  }

  return getStoredTasks(targetId);
}

export function getStoredTasks(userId?: string): Task[] {
  if (typeof window === "undefined") return [];
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export async function createDbTask(task: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const targetId = task.userId || getEffectiveUserId();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: targetId,
          title: task.title,
          description: task.description,
          category: task.category,
          start_time: task.startTime,
          end_time: task.endTime,
          recurrence: task.recurrence,
          recurrence_config: task.recurrenceConfig,
          tracking_type: task.trackingType,
          target_value: task.targetValue,
          unit: task.unit,
          is_active: false,
          is_archived: false,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      const created = mapDbTaskToModel(data);
      const current = getStoredTasks(targetId);
      const updated = [created, ...current.filter((t) => t.id !== created.id)];
      saveStoredTasks(updated, targetId);
      return created;
    }
  } catch (err) {
    console.warn("Supabase createDbTask fallback:", err);
  }

  // Local fallback
  const localTask: Task = {
    ...task,
    id: "task-" + Date.now(),
    userId: targetId,
    isActive: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const current = getStoredTasks(targetId);
  const updated = [localTask, ...current];
  saveStoredTasks(updated, targetId);
  return localTask;
}

export async function updateDbTaskActive(taskId: string, isActive: boolean, userId?: string): Promise<void> {
  const targetId = getEffectiveUserId(userId);

  try {
    const supabase = createClient();
    // Deactivate others
    if (isActive) {
      await supabase.from("tasks").update({ is_active: false }).eq("user_id", targetId);
    }
    await supabase.from("tasks").update({ is_active: isActive }).eq("id", taskId);
  } catch (err) {
    console.warn("Supabase updateDbTaskActive fallback:", err);
  }

  const tasks = getStoredTasks(targetId);
  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return { ...t, isActive, updatedAt: new Date().toISOString() };
    }
    return isActive ? { ...t, isActive: false } : t;
  });
  saveStoredTasks(updated, targetId);
}

export async function deleteDbTask(taskId: string, userId?: string): Promise<void> {
  const targetId = getEffectiveUserId(userId);

  try {
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", taskId);
  } catch (err) {
    console.warn("Supabase deleteDbTask fallback:", err);
  }

  const tasks = getStoredTasks(targetId);
  const updated = tasks.filter((t) => t.id !== taskId);
  saveStoredTasks(updated, targetId);
}

export function saveStoredTasks(tasks: Task[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(tasks));
}

export async function fetchCompletions(userId?: string): Promise<TaskCompletion[]> {
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("task_completions")
      .select("*")
      .eq("user_id", targetId);

    if (!error && data) {
      const mapped = data.map(mapDbCompletionToModel);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(mapped));
      }
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchCompletions fallback:", err);
  }

  return getStoredCompletions(targetId);
}

export function getStoredCompletions(userId?: string): TaskCompletion[] {
  if (typeof window === "undefined") return [];
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export async function upsertDbCompletion(
  completion: Omit<TaskCompletion, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<void> {
  const targetId = completion.userId || getEffectiveUserId();

  try {
    const supabase = createClient();
    await supabase.from("task_completions").upsert(
      [
        {
          task_id: completion.taskId,
          user_id: targetId,
          date: completion.date,
          completed: completion.completed,
          value: completion.value,
          duration: completion.duration,
          notes: completion.notes,
        },
      ],
      { onConflict: "task_id,date" }
    );
  } catch (err) {
    console.warn("Supabase upsertDbCompletion fallback:", err);
  }

  const completions = getStoredCompletions(targetId);
  const existingIdx = completions.findIndex(
    (c) => c.taskId === completion.taskId && c.date === completion.date
  );

  let updated: TaskCompletion[];
  if (existingIdx >= 0) {
    updated = [...completions];
    updated[existingIdx] = {
      ...updated[existingIdx],
      completed: completion.completed,
      value: completion.value !== undefined ? completion.value : updated[existingIdx].value,
      duration: completion.duration !== undefined ? completion.duration : updated[existingIdx].duration,
      updatedAt: new Date().toISOString(),
    };
  } else {
    const newRecord: TaskCompletion = {
      ...completion,
      id: "comp-" + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updated = [newRecord, ...completions];
  }

  saveStoredCompletions(updated, targetId);
}

export function saveStoredCompletions(completions: TaskCompletion[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(completions));
}
