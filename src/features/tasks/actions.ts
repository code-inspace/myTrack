import { Task, TaskCompletion } from "./types";
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
    targetValue: row.target_value !== null && row.target_value !== undefined ? parseFloat(row.target_value) : null,
    unit: row.unit || null,
    isActive: Boolean(row.is_active),
    startedAt: row.started_at || null,
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
  const supabase = createClient();
  let targetId = userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const key = TASKS_STORAGE_PREFIX + targetId;

  try {
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
    console.warn("Supabase fetchTasks error:", err);
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
  const supabase = createClient();
  let targetId = task.userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: targetId,
          title: task.title,
          description: task.description || null,
          category: task.category || "General",
          start_time: task.startTime || null,
          end_time: task.endTime || null,
          recurrence: task.recurrence,
          recurrence_config: task.recurrenceConfig || null,
          tracking_type: task.trackingType,
          target_value: task.targetValue !== undefined ? task.targetValue : null,
          unit: task.unit || null,
          is_active: false,
          started_at: null,
          is_archived: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase createDbTask error:", error);
      throw new Error(error.message);
    }

    if (data) {
      const created = mapDbTaskToModel(data);
      const current = getStoredTasks(targetId);
      const updated = [created, ...current.filter((t) => t.id !== created.id)];
      saveStoredTasks(updated, targetId);
      return created;
    }
  } catch (err) {
    console.error("Supabase createDbTask failed:", err);
    throw err;
  }

  throw new Error("Impossible d'enregistrer la tâche sur Supabase");
}

export async function updateDbTaskActive(taskId: string, isActive: boolean, userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const nowIso = new Date().toISOString();

  try {
    if (isActive) {
      // Deactivate all other tasks for this user
      await supabase
        .from("tasks")
        .update({ is_active: false, started_at: null, updated_at: nowIso })
        .eq("user_id", targetId);

      // Activate target task with started_at = now
      await supabase
        .from("tasks")
        .update({ is_active: true, started_at: nowIso, updated_at: nowIso })
        .eq("id", taskId);
    } else {
      // Stop target task
      await supabase
        .from("tasks")
        .update({ is_active: false, started_at: null, updated_at: nowIso })
        .eq("id", taskId);
    }
  } catch (err) {
    console.warn("Supabase updateDbTaskActive error:", err);
  }

  const tasks = getStoredTasks(targetId);
  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        isActive,
        startedAt: isActive ? nowIso : null,
        updatedAt: nowIso,
      };
    }
    return isActive ? { ...t, isActive: false, startedAt: null } : t;
  });
  saveStoredTasks(updated, targetId);
}

export async function deleteDbTask(taskId: string, userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    await supabase.from("tasks").delete().eq("id", taskId);
  } catch (err) {
    console.warn("Supabase deleteDbTask error:", err);
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
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  try {
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
    console.warn("Supabase fetchCompletions error:", err);
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
  const supabase = createClient();
  let targetId = completion.userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
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
    console.warn("Supabase upsertDbCompletion error:", err);
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
