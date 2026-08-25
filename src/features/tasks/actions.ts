import { Task, TaskCompletion, TaskFormValues } from "./types";
import { getStoredUserSession, DEMO_USER } from "@/features/auth/actions";
import { createClient } from "@/utils/supabase/client";
import { getTodayDateString, convertLocalTimeToUtc, convertUtcTimeToLocal, createUtcIsoFromLocalDateTime, subtractMinutesFromTime } from "@/lib/dates";
import { scheduleTaskPushNotification, cancelTaskPushNotifications } from "@/lib/onesignal/client";
import { getStoredProjects } from "@/features/projects/actions";
import { getProjectColumns } from "@/features/projects/types";

const TASKS_STORAGE_PREFIX = "mytrack_tasks_";
const COMPLETIONS_STORAGE_PREFIX = "mytrack_completions_";

export function getEffectiveUserId(explicitUserId?: string): string {
  if (explicitUserId) return explicitUserId;
  const session = getStoredUserSession();
  return session?.id || DEMO_USER.id;
}

// Convert Supabase snake_case task row to camelCase Task with local timezone conversion
function mapDbTaskToModel(row: any): Task {
  const rawOverrides = row.date_overrides || {};
  const dateOverrides: Record<string, any> = {};

  for (const [k, v] of Object.entries(rawOverrides)) {
    if (k.startsWith("_")) {
      dateOverrides[k] = v;
    } else if (v && typeof v === "object") {
      dateOverrides[k] = {
        ...(v as any),
        startTime: (v as any).startTime ? convertUtcTimeToLocal((v as any).startTime, k) : null,
        endTime: (v as any).endTime ? convertUtcTimeToLocal((v as any).endTime, k) : null,
      };
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || null,
    category: row.category || "General",
    startTime: row.start_time ? convertUtcTimeToLocal(row.start_time) : null,
    endTime: row.end_time ? convertUtcTimeToLocal(row.end_time) : null,
    deadline: row.deadline || null,
    priority: row.priority || "NORMAL",
    recurrence: row.recurrence,
    recurrenceConfig: row.recurrence_config || null,
    dateOverrides,
    trackingType: row.tracking_type,
    targetValue: row.target_value !== null && row.target_value !== undefined ? parseFloat(row.target_value) : null,
    unit: row.unit || null,
    enableReminders:
      row.enable_reminders !== undefined && row.enable_reminders !== null
        ? Boolean(row.enable_reminders)
        : rawOverrides._enableReminders !== undefined
        ? Boolean(rawOverrides._enableReminders)
        : true,
    reminderOffsetMinutes:
      row.reminder_offset_minutes !== undefined && row.reminder_offset_minutes !== null
        ? row.reminder_offset_minutes
        : (rawOverrides._reminderOffsetMinutes ?? 10),
    reminderTimes: row.reminder_times || rawOverrides._reminderTimes || ["11:00", "18:00"],
    isActive: Boolean(row.is_active),
    startedAt: row.started_at || null,
    isArchived: Boolean(row.is_archived),
    sortOrder: row.sort_order !== undefined && row.sort_order !== null ? row.sort_order : null,
    projectId: row.project_id || null,
    projectStatus: row.project_status || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// Convert Supabase snake_case completion row to camelCase TaskCompletion with local timezone conversion
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
    scheduledStartTime: row.scheduled_start_time ? convertUtcTimeToLocal(row.scheduled_start_time, row.date) : null,
    scheduledEndTime: row.scheduled_end_time ? convertUtcTimeToLocal(row.scheduled_end_time, row.date) : null,
    actualStartTime: row.actual_start_time ? convertUtcTimeToLocal(row.actual_start_time, row.date) : null,
    actualEndTime: row.actual_end_time ? convertUtcTimeToLocal(row.actual_end_time, row.date) : null,
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

export async function createDbTask(task: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const supabase = createClient();
  let targetId = task.userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const taskOverrides = {
    ...(task.dateOverrides || {}),
    _enableReminders: task.enableReminders !== undefined ? task.enableReminders : false,
    _reminderOffsetMinutes: task.reminderOffsetMinutes !== undefined ? task.reminderOffsetMinutes : 10,
    _reminderTimes: task.reminderTimes || ["11:00", "18:00"],
  };

  const taskDate = (task as any).date || getTodayDateString();
  const createdIso = taskDate ? `${taskDate}T12:00:00.000Z` : new Date().toISOString();

  const utcStartTime = task.startTime ? convertLocalTimeToUtc(task.startTime, taskDate) : null;
  const utcEndTime = task.endTime ? convertLocalTimeToUtc(task.endTime, taskDate) : null;

  const insertPayload: any = {
    user_id: targetId,
    title: task.title,
    description: task.description || null,
    category: task.category || "General",
    start_time: utcStartTime,
    end_time: utcEndTime,
    deadline: task.deadline || null,
    priority: task.priority || "NORMAL",
    recurrence: task.recurrence,
    recurrence_config: task.recurrenceConfig || null,
    date_overrides: taskOverrides,
    tracking_type: task.trackingType,
    target_value: task.targetValue !== undefined ? task.targetValue : null,
    unit: task.unit || null,
    is_active: false,
    started_at: null,
    is_archived: false,
    project_id: task.projectId || null,
    project_status: task.projectId ? task.projectStatus || "TODO" : null,
    created_at: createdIso,
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

      if (created.enableReminders) {
        const scheduledIso = created.startTime
          ? createUtcIsoFromLocalDateTime(created.startTime, taskDate)
          : undefined;
        scheduleTaskPushNotification({
          userId: targetId,
          taskId: created.id,
          taskTitle: created.title,
          startTime: created.startTime,
          scheduledIso,
          replaceExisting: true,
          reminderOffsetMinutes: created.reminderOffsetMinutes ?? 10,
          reminderTimes: created.reminderTimes || ["11:00", "18:00"],
          date: taskDate,
          category: created.category,
        }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
      }

      return created;
    }
    if (error) {
      console.warn("Supabase createDbTask fallback:", error);
    }
  } catch (err) {
    console.warn("Supabase createDbTask error fallback:", err);
  }

  // Local fallback
  const createdLocal: Task = {
    id: "task-" + Date.now(),
    userId: targetId,
    title: task.title,
    description: task.description || null,
    category: task.category || "General",
    startTime: task.startTime || null,
    endTime: task.endTime || null,
    deadline: task.deadline || null,
    priority: task.priority || "NORMAL",
    recurrence: task.recurrence,
    recurrenceConfig: task.recurrenceConfig || null,
    dateOverrides: taskOverrides,
    trackingType: task.trackingType,
    targetValue: task.targetValue !== undefined ? task.targetValue : null,
    unit: task.unit || null,
    enableReminders: task.enableReminders !== undefined ? task.enableReminders : false,
    reminderOffsetMinutes: task.reminderOffsetMinutes !== undefined ? task.reminderOffsetMinutes : 10,
    reminderTimes: task.reminderTimes || ["11:00", "18:00"],
    isActive: false,
    startedAt: null,
    isArchived: false,
    sortOrder: null,
    projectId: task.projectId || null,
    projectStatus: task.projectId ? task.projectStatus || "TODO" : null,
    createdAt: createdIso,
    updatedAt: new Date().toISOString(),
  };
  const current = getStoredTasks(targetId);
  const updated = [createdLocal, ...current];
  saveStoredTasks(updated, targetId);

  if (createdLocal.enableReminders) {
    const scheduledIso = createdLocal.startTime
      ? createUtcIsoFromLocalDateTime(createdLocal.startTime, taskDate)
      : undefined;
    scheduleTaskPushNotification({
      userId: targetId,
      taskId: createdLocal.id,
      taskTitle: createdLocal.title,
      startTime: createdLocal.startTime,
      scheduledIso,
      replaceExisting: true,
      reminderOffsetMinutes: createdLocal.reminderOffsetMinutes ?? 10,
      reminderTimes: createdLocal.reminderTimes || ["11:00", "18:00"],
      date: taskDate,
      category: createdLocal.category,
    }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
  }

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
  if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime ? convertLocalTimeToUtc(updates.startTime, updates.date) : null;
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime ? convertLocalTimeToUtc(updates.endTime, updates.date) : null;
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline || null;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority || "NORMAL";
  if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
  if (updates.recurrenceConfig !== undefined) dbUpdates.recurrence_config = updates.recurrenceConfig;
  if (updates.trackingType !== undefined) dbUpdates.tracking_type = updates.trackingType;
  if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue;
  if (updates.unit !== undefined) dbUpdates.unit = updates.unit || null;
  if (updates.projectId !== undefined) {
    dbUpdates.project_id = updates.projectId || null;
    dbUpdates.project_status = updates.projectId ? (updates.projectStatus || target?.projectStatus || "TODO") : null;
  } else if (updates.projectStatus !== undefined) {
    dbUpdates.project_status = updates.projectStatus || null;
  }
  if (updates.date !== undefined && (updates.recurrence === "ONCE" || target?.recurrence === "ONCE")) {
    dbUpdates.created_at = `${updates.date}T12:00:00.000Z`;
  }

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

      if (updated.enableReminders) {
        const targetDate = updates.date || getTodayDateString();
        const scheduledIso = updated.startTime
          ? createUtcIsoFromLocalDateTime(updated.startTime, targetDate)
          : undefined;
        scheduleTaskPushNotification({
          userId: targetId,
          taskId: updated.id,
          taskTitle: updated.title,
          startTime: updated.startTime,
          scheduledIso,
          replaceExisting: true,
          reminderOffsetMinutes: updated.reminderOffsetMinutes ?? 10,
          reminderTimes: updated.reminderTimes || ["11:00", "18:00"],
          date: targetDate,
          category: updated.category,
        }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
      } else {
        cancelTaskPushNotifications({
          taskId: updated.id,
          userId: targetId,
        }).catch(() => {});
      }

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
    deadline: updates.deadline !== undefined ? (updates.deadline || null) : baseTask.deadline,
    priority: updates.priority !== undefined ? (updates.priority || "NORMAL") : baseTask.priority,
    recurrence: updates.recurrence !== undefined ? updates.recurrence : baseTask.recurrence,
    recurrenceConfig: updates.recurrenceConfig !== undefined ? updates.recurrenceConfig : baseTask.recurrenceConfig,
    trackingType: updates.trackingType !== undefined ? updates.trackingType : baseTask.trackingType,
    targetValue: updates.targetValue !== undefined ? updates.targetValue : baseTask.targetValue,
    unit: updates.unit !== undefined ? (updates.unit || null) : baseTask.unit,
    dateOverrides: newOverrides,
    enableReminders: updates.enableReminders !== undefined ? updates.enableReminders : baseTask.enableReminders ?? true,
    reminderOffsetMinutes: updates.reminderOffsetMinutes !== undefined ? updates.reminderOffsetMinutes : baseTask.reminderOffsetMinutes ?? 10,
    reminderTimes: updates.reminderTimes !== undefined ? updates.reminderTimes : baseTask.reminderTimes || ["11:00", "18:00"],
    projectId: updates.projectId !== undefined ? (updates.projectId || null) : baseTask.projectId,
    projectStatus:
      updates.projectId !== undefined
        ? (updates.projectId ? updates.projectStatus || baseTask.projectStatus || "TODO" : null)
        : updates.projectStatus !== undefined
        ? updates.projectStatus || null
        : baseTask.projectStatus,
    updatedAt: nowIso,
  };
  const nextList = target
    ? tasks.map((t) => (t.id === taskId ? updatedTask : t))
    : [updatedTask, ...tasks];
  saveStoredTasks(nextList, targetId);

  if (updatedTask.enableReminders) {
    const targetDate = updates.date || getTodayDateString();
    const scheduledIso = updatedTask.startTime
      ? createUtcIsoFromLocalDateTime(updatedTask.startTime, targetDate)
      : undefined;
    scheduleTaskPushNotification({
      userId: targetId,
      taskId: updatedTask.id,
      taskTitle: updatedTask.title,
      startTime: updatedTask.startTime,
      scheduledIso,
      replaceExisting: true,
      reminderOffsetMinutes: updatedTask.reminderOffsetMinutes ?? 10,
      reminderTimes: updatedTask.reminderTimes || ["11:00", "18:00"],
      date: targetDate,
      category: updatedTask.category,
    }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
  } else {
    cancelTaskPushNotifications({
      taskId: updatedTask.id,
      userId: targetId,
    }).catch(() => {});
  }

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
      // Activate target task with started_at = now (without deactivating other parallel tasks)
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
    return t;
  });
  saveStoredTasks(updated, targetId);
}

export async function updateDbTaskStartedAt(
  taskId: string,
  startedAtTime: string,
  userId?: string
): Promise<{ startedAt: string }> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const now = new Date();
  const [hours, minutes] = startedAtTime.split(":").map((v) => parseInt(v, 10) || 0);
  const newStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  const newStartedAtIso = newStartDate.toISOString();
  const nowIso = now.toISOString();
  const todayStr = getTodayDateString();

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const isRecurring = target?.recurrence && target.recurrence !== "ONCE";

  // Calculate new end time if current end time is before new start time
  let provisionalEndTime = target?.endTime;
  if (!provisionalEndTime) {
    const endH = (hours + 1) % 24;
    provisionalEndTime = `${String(endH).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const utcStartTime = convertLocalTimeToUtc(startedAtTime, todayStr);
  const utcProvisionalEndTime = convertLocalTimeToUtc(provisionalEndTime, todayStr);

  const currentOverrides = target?.dateOverrides || {};
  const updatedOverrides = {
    ...currentOverrides,
    [todayStr]: {
      ...(currentOverrides[todayStr] || {}),
      startTime: utcStartTime,
      endTime: utcProvisionalEndTime,
    },
  };

  const dbUpdates: any = {
    started_at: newStartedAtIso,
    updated_at: nowIso,
    date_overrides: updatedOverrides,
  };

  if (!isRecurring) {
    dbUpdates.start_time = utcStartTime;
    dbUpdates.end_time = utcProvisionalEndTime;
  }

  try {
    await supabase
      .from("tasks")
      .update(dbUpdates)
      .eq("id", taskId);
  } catch (err) {
    console.warn("Supabase updateDbTaskStartedAt error:", err);
  }

  // Update completions actualStartTime as well
  try {
    await supabase
      .from("task_completions")
      .update({
        actual_start_time: utcStartTime,
        scheduled_start_time: utcStartTime,
        updated_at: nowIso,
      })
      .eq("task_id", taskId)
      .eq("date", todayStr);
  } catch (err) {
    console.warn("Supabase updateDbTaskStartedAt completion error:", err);
  }

  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        startedAt: newStartedAtIso,
        startTime: !isRecurring ? startedAtTime : t.startTime,
        endTime: !isRecurring ? provisionalEndTime : t.endTime,
        dateOverrides: {
          ...currentOverrides,
          [todayStr]: {
            ...(currentOverrides[todayStr] || {}),
            startTime: startedAtTime,
            endTime: provisionalEndTime,
          },
        },
        updatedAt: nowIso,
      };
    }
    return t;
  });
  saveStoredTasks(updated, targetId);

  // Update localStorage completions too
  const completions = getStoredCompletions(targetId);
  const compIdx = completions.findIndex((c) => c.taskId === taskId && c.date === todayStr);
  if (compIdx >= 0) {
    const nextCompletions = [...completions];
    nextCompletions[compIdx] = {
      ...nextCompletions[compIdx],
      actualStartTime: startedAtTime,
      scheduledStartTime: startedAtTime,
      updatedAt: nowIso,
    };
    saveStoredCompletions(nextCompletions, targetId);
  }

  return { startedAt: newStartedAtIso };
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
  const utcStart = startTime ? convertLocalTimeToUtc(startTime, date) : null;
  const utcEnd = endTime ? convertLocalTimeToUtc(endTime, date) : null;

  if (isRecurring && !applyToAll) {
    // Specific day override
    const currentOverrides = target?.dateOverrides || {};
    const updatedOverrides = {
      ...currentOverrides,
      [date]: { startTime: utcStart, endTime: utcEnd },
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
      t.id === taskId
        ? {
            ...t,
            dateOverrides: {
              ...currentOverrides,
              [date]: { startTime, endTime },
            },
            updatedAt: nowIso,
          }
        : t
    );
    saveStoredTasks(updated, targetId);
  } else {
    // Global schedule update
    try {
      await supabase
        .from("tasks")
        .update({ start_time: utcStart, end_time: utcEnd, updated_at: nowIso })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule global error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, startTime, endTime, updatedAt: nowIso } : t
    );
    saveStoredTasks(updated, targetId);
  }

  // Reschedule or cancel push notification for this task
  if (target && target.enableReminders !== false) {
    const scheduledIso = startTime ? createUtcIsoFromLocalDateTime(startTime, date) : undefined;
    scheduleTaskPushNotification({
      userId: targetId,
      taskId: target.id,
      taskTitle: target.title,
      startTime,
      scheduledIso,
      replaceExisting: true,
      reminderOffsetMinutes: target.reminderOffsetMinutes ?? 10,
      reminderTimes: target.reminderTimes || ["11:00", "18:00"],
      date,
      category: target.category,
    }).catch((e) => console.warn("updateTaskSchedule reminder note:", e));
  } else if (target) {
    cancelTaskPushNotifications({
      taskId: target.id,
      userId: targetId,
    }).catch(() => {});
  }
}

/**
 * Marks a task as completed "now". If it was never started (no actualStartTime recorded yet for
 * that day), defaults to a 30-minute block ending now and reflects that window in the task's own
 * schedule so it shows up positioned in the Agenda. Idempotent — safe to call on an
 * already-completed task (e.g. re-dropping a card on a Kanban "done" column).
 */
export async function closeTaskAsCompleted(
  taskId: string,
  date: string,
  userId?: string,
  options?: { value?: number | null; duration?: number | null }
): Promise<void> {
  const supabase = createClient();
  const session = !userId ? (await supabase.auth.getSession()).data.session : null;
  const targetId: string = userId || session?.user?.id || getEffectiveUserId();

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const completions = getStoredCompletions(targetId);
  const existing = completions.find((c) => c.taskId === taskId && c.date === date);

  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const wasStarted = Boolean(existing?.actualStartTime);
  const actualStartTime = wasStarted ? existing!.actualStartTime! : subtractMinutesFromTime(nowTime, 30);

  if (!wasStarted) {
    const isRecurring = target?.recurrence && target.recurrence !== "ONCE";
    await updateTaskSchedule({
      taskId,
      date,
      startTime: actualStartTime,
      endTime: nowTime,
      applyToAll: !isRecurring,
      userId: targetId,
    });
  }

  await upsertDbCompletion({
    taskId,
    userId: targetId,
    date,
    completed: true,
    value: options?.value !== undefined ? options.value : existing?.value || null,
    duration: options?.duration !== undefined ? options.duration : existing?.duration || null,
    scheduledStartTime: target?.startTime || existing?.scheduledStartTime || null,
    scheduledEndTime: target?.endTime || existing?.scheduledEndTime || null,
    actualStartTime,
    actualEndTime: nowTime,
    notes: null,
  });

  // A completed task that belongs to a project also moves onto that project's Kanban board's
  // "done" column, regardless of which screen (habit list, agenda, voice) it was completed from.
  if (target?.projectId) {
    const project = getStoredProjects(targetId).find((p) => p.id === target.projectId);
    const doneColumn = project ? getProjectColumns(project).find((c) => c.isDone) : undefined;
    if (doneColumn && target.projectStatus !== doneColumn.id) {
      await updateDbTask(taskId, { projectStatus: doneColumn.id }, targetId);
    }
  }
}

/**
 * Persists a new drag-and-drop priority order for a set of tasks (0..n-1 by array position).
 */
export async function updateTaskSortOrder(taskIds: string[], userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const nowIso = new Date().toISOString();

  try {
    await Promise.all(
      taskIds.map((taskId, index) =>
        supabase
          .from("tasks")
          .update({ sort_order: index, updated_at: nowIso })
          .eq("id", taskId)
      )
    );
  } catch (err) {
    console.warn("Supabase updateTaskSortOrder error:", err);
  }

  const tasks = getStoredTasks(targetId);
  const orderMap = new Map(taskIds.map((id, index) => [id, index]));
  const updated = tasks.map((t) =>
    orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)!, updatedAt: nowIso } : t
  );
  saveStoredTasks(updated, targetId);
}

/**
 * Moves a single occurrence of a task from one date to another (used by drag-and-drop onto the day strip).
 * For a ONCE task this just changes its date. For a recurring task, the origin date is marked "skipped"
 * and the destination date gets an added-occurrence override, both stored in the existing dateOverrides JSONB.
 */
export async function moveTaskOccurrence(
  taskId: string,
  fromDate: string,
  toDate: string,
  userId?: string
): Promise<void> {
  if (fromDate === toDate) return;

  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return;

  const nowIso = new Date().toISOString();

  if (target.recurrence === "ONCE") {
    await updateDbTask(taskId, { date: toDate, recurrence: "ONCE" }, targetId);
    return;
  }

  const currentOverrides = target.dateOverrides || {};
  const carriedStart = currentOverrides[fromDate]?.startTime ?? target.startTime ?? null;
  const carriedEnd = currentOverrides[fromDate]?.endTime ?? target.endTime ?? null;

  const updatedOverrides = {
    ...currentOverrides,
    [fromDate]: { skipped: true },
    [toDate]: { startTime: carriedStart, endTime: carriedEnd, movedFrom: fromDate },
  };

  try {
    await supabase
      .from("tasks")
      .update({ date_overrides: updatedOverrides, updated_at: nowIso })
      .eq("id", taskId);
  } catch (err) {
    console.warn("Supabase moveTaskOccurrence error:", err);
  }

  const updated = tasks.map((t) =>
    t.id === taskId ? { ...t, dateOverrides: updatedOverrides, updatedAt: nowIso } : t
  );
  saveStoredTasks(updated, targetId);
}

export async function deleteDbTask(taskId: string, userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  // Cancel any pending push notifications for this task before removing it
  await cancelTaskPushNotifications({
    taskId,
    userId: targetId,
  }).catch(() => {});

  try {
    // Hard-delete associated reminders (don't rely solely on DB-level ON DELETE CASCADE)
    await supabase.from("reminders").delete().eq("task_id", taskId);
  } catch (err) {
    console.warn("Supabase deleteDbTask reminders cleanup error:", err);
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
          scheduled_start_time: completion.scheduledStartTime
            ? convertLocalTimeToUtc(completion.scheduledStartTime, completion.date)
            : null,
          scheduled_end_time: completion.scheduledEndTime
            ? convertLocalTimeToUtc(completion.scheduledEndTime, completion.date)
            : null,
          actual_start_time: completion.actualStartTime
            ? convertLocalTimeToUtc(completion.actualStartTime, completion.date)
            : null,
          actual_end_time: completion.actualEndTime
            ? convertLocalTimeToUtc(completion.actualEndTime, completion.date)
            : null,
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
