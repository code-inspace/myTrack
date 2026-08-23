import { Task, TaskCompletion, TaskFormValues } from "./types";
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
  const overrides = row.date_overrides || {};
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
    dateOverrides: overrides,
    trackingType: row.tracking_type,
    targetValue: row.target_value !== null && row.target_value !== undefined ? parseFloat(row.target_value) : null,
    unit: row.unit || null,
    enableReminders:
      row.enable_reminders !== undefined && row.enable_reminders !== null
        ? Boolean(row.enable_reminders)
        : overrides._enableReminders !== undefined
        ? Boolean(overrides._enableReminders)
        : true,
    reminderOffsetMinutes:
      row.reminder_offset_minutes !== undefined && row.reminder_offset_minutes !== null
        ? row.reminder_offset_minutes
        : (overrides._reminderOffsetMinutes ?? 10),
    reminderTimes: row.reminder_times || overrides._reminderTimes || ["11:00", "18:00"],
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
    scheduledStartTime: row.scheduled_start_time || null,
    scheduledEndTime: row.scheduled_end_time || null,
    actualStartTime: row.actual_start_time || null,
    actualEndTime: row.actual_end_time || null,
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

import { generateDemoSeedTasks, generateDemoSeedCompletions } from "./demoSeed";

export function getStoredTasks(userId?: string): Task[] {
  if (typeof window === "undefined") return generateDemoSeedTasks();
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    const seed = generateDemoSeedTasks(targetId);
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length === 0 && targetId === DEMO_USER.id) {
      const seed = generateDemoSeedTasks(targetId);
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return parsed;
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

  const taskOverrides = {
    ...(task.dateOverrides || {}),
    _enableReminders: task.enableReminders !== undefined ? task.enableReminders : true,
    _reminderOffsetMinutes: task.reminderOffsetMinutes !== undefined ? task.reminderOffsetMinutes : 10,
    _reminderTimes: task.reminderTimes || ["11:00", "18:00"],
  };

  const insertPayload: any = {
    user_id: targetId,
    title: task.title,
    description: task.description || null,
    category: task.category || "General",
    start_time: task.startTime || null,
    end_time: task.endTime || null,
    recurrence: task.recurrence,
    recurrence_config: task.recurrenceConfig || null,
    date_overrides: taskOverrides,
    tracking_type: task.trackingType,
    target_value: task.targetValue !== undefined ? task.targetValue : null,
    unit: task.unit || null,
    is_active: false,
    started_at: null,
    is_archived: false,
  };

  try {
    const { data, error } = await supabase
      .from("tasks")
      .insert([insertPayload])
      .select()
      .single();

    if (!error && data) {
      const created = mapDbTaskToModel(data);
      const current = getStoredTasks(targetId);
      const updated = [created, ...current.filter((t) => t.id !== created.id)];
      saveStoredTasks(updated, targetId);
      return created;
    }
    if (error) {
      console.warn("Supabase createDbTask fallback:", error);
    }
  } catch (err) {
    console.warn("Supabase createDbTask error fallback:", err);
  }

  // Local fallback
  const nowIso = new Date().toISOString();
  const createdLocal: Task = {
    id: "task-" + Date.now(),
    userId: targetId,
    title: task.title,
    description: task.description || null,
    category: task.category || "General",
    startTime: task.startTime || null,
    endTime: task.endTime || null,
    recurrence: task.recurrence,
    recurrenceConfig: task.recurrenceConfig || null,
    dateOverrides: taskOverrides,
    trackingType: task.trackingType,
    targetValue: task.targetValue !== undefined ? task.targetValue : null,
    unit: task.unit || null,
    enableReminders: task.enableReminders !== undefined ? task.enableReminders : true,
    reminderOffsetMinutes: task.reminderOffsetMinutes !== undefined ? task.reminderOffsetMinutes : 10,
    reminderTimes: task.reminderTimes || ["11:00", "18:00"],
    isActive: false,
    startedAt: null,
    isArchived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const current = getStoredTasks(targetId);
  const updated = [createdLocal, ...current];
  saveStoredTasks(updated, targetId);
  return createdLocal;
}

export async function updateDbTask(
  taskId: string,
  updates: Partial<TaskFormValues>,
  userId?: string
): Promise<Task> {
  const supabase = createClient();
  let targetId: string = userId || "";
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const nowIso = new Date().toISOString();

  const currentOverrides = target?.dateOverrides || {};
  const newOverrides = {
    ...currentOverrides,
    ...(updates.enableReminders !== undefined ? { _enableReminders: updates.enableReminders } : {}),
    ...(updates.reminderOffsetMinutes !== undefined ? { _reminderOffsetMinutes: updates.reminderOffsetMinutes } : {}),
    ...(updates.reminderTimes !== undefined ? { _reminderTimes: updates.reminderTimes } : {}),
  };

  const dbUpdates: any = {
    updated_at: nowIso,
    date_overrides: newOverrides,
  };

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description || null;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime || null;
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime || null;
  if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
  if (updates.recurrenceConfig !== undefined) dbUpdates.recurrence_config = updates.recurrenceConfig;
  if (updates.trackingType !== undefined) dbUpdates.tracking_type = updates.trackingType;
  if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue;
  if (updates.unit !== undefined) dbUpdates.unit = updates.unit || null;

  try {
    const { data, error } = await supabase
      .from("tasks")
      .update(dbUpdates)
      .eq("id", taskId)
      .select()
      .single();

    if (!error && data) {
      const updated = mapDbTaskToModel(data);
      const nextList = tasks.map((t) => (t.id === taskId ? updated : t));
      saveStoredTasks(nextList, targetId);
      return updated;
    }
  } catch (err) {
    console.warn("Supabase updateDbTask error:", err);
  }

  // Local fallback
  const baseTask: Task = target || {
    id: taskId,
    userId: targetId,
    title: "Habitude",
    category: "General",
    recurrence: "ONCE",
    trackingType: "BOOLEAN",
    isActive: false,
    isArchived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const updatedTask: Task = {
    ...baseTask,
    id: taskId,
    userId: targetId,
    title: updates.title !== undefined ? updates.title : baseTask.title,
    description: updates.description !== undefined ? (updates.description || null) : baseTask.description,
    category: updates.category !== undefined ? updates.category : baseTask.category,
    startTime: updates.startTime !== undefined ? (updates.startTime || null) : baseTask.startTime,
    endTime: updates.endTime !== undefined ? (updates.endTime || null) : baseTask.endTime,
    recurrence: updates.recurrence !== undefined ? updates.recurrence : baseTask.recurrence,
    recurrenceConfig: updates.recurrenceConfig !== undefined ? updates.recurrenceConfig : baseTask.recurrenceConfig,
    trackingType: updates.trackingType !== undefined ? updates.trackingType : baseTask.trackingType,
    targetValue: updates.targetValue !== undefined ? updates.targetValue : baseTask.targetValue,
    unit: updates.unit !== undefined ? (updates.unit || null) : baseTask.unit,
    dateOverrides: newOverrides,
    enableReminders: updates.enableReminders !== undefined ? updates.enableReminders : baseTask.enableReminders ?? true,
    reminderOffsetMinutes: updates.reminderOffsetMinutes !== undefined ? updates.reminderOffsetMinutes : baseTask.reminderOffsetMinutes ?? 10,
    reminderTimes: updates.reminderTimes !== undefined ? updates.reminderTimes : baseTask.reminderTimes || ["11:00", "18:00"],
    updatedAt: nowIso,
  };
  const nextList = target
    ? tasks.map((t) => (t.id === taskId ? updatedTask : t))
    : [updatedTask, ...tasks];
  saveStoredTasks(nextList, targetId);
  return updatedTask;
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

/**
 * Updates schedule for a specific date (or globally).
 * If task is recurring and not applyToAll, saves to dateOverrides[date].
 */
export async function updateTaskSchedule({
  taskId,
  date,
  startTime,
  endTime,
  applyToAll = false,
  userId,
}: {
  taskId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  applyToAll?: boolean;
  userId?: string;
}): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const nowIso = new Date().toISOString();

  const isRecurring = target?.recurrence && target.recurrence !== "ONCE";

  if (isRecurring && !applyToAll) {
    // Specific day override
    const currentOverrides = target?.dateOverrides || {};
    const updatedOverrides = {
      ...currentOverrides,
      [date]: { startTime, endTime },
    };

    try {
      await supabase
        .from("tasks")
        .update({ date_overrides: updatedOverrides, updated_at: nowIso })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule override error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, dateOverrides: updatedOverrides, updatedAt: nowIso } : t
    );
    saveStoredTasks(updated, targetId);
  } else {
    // Global schedule update
    try {
      await supabase
        .from("tasks")
        .update({ start_time: startTime, end_time: endTime, updated_at: nowIso })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule global error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, startTime, endTime, updatedAt: nowIso } : t
    );
    saveStoredTasks(updated, targetId);
  }
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
  if (typeof window === "undefined") return generateDemoSeedCompletions();
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    const seed = generateDemoSeedCompletions(targetId);
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length === 0 && targetId === DEMO_USER.id) {
      const seed = generateDemoSeedCompletions(targetId);
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return parsed;
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
          scheduled_start_time: completion.scheduledStartTime || null,
          scheduled_end_time: completion.scheduledEndTime || null,
          actual_start_time: completion.actualStartTime || null,
          actual_end_time: completion.actualEndTime || null,
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
      scheduledStartTime: completion.scheduledStartTime !== undefined ? completion.scheduledStartTime : updated[existingIdx].scheduledStartTime,
      scheduledEndTime: completion.scheduledEndTime !== undefined ? completion.scheduledEndTime : updated[existingIdx].scheduledEndTime,
      actualStartTime: completion.actualStartTime !== undefined ? completion.actualStartTime : updated[existingIdx].actualStartTime,
      actualEndTime: completion.actualEndTime !== undefined ? completion.actualEndTime : updated[existingIdx].actualEndTime,
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
