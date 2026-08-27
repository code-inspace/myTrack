import { Task, TaskFormValues } from "../types";
import { getEffectiveUserId } from "./user";
import { mapDbTaskToModel, TASKS_STORAGE_PREFIX } from "./mappers";
import { getStoredTasks, saveStoredTasks } from "./storage";
import { createClient } from "@/utils/supabase/client";
import {
  getTodayDateString,
  convertLocalTimeToUtc,
  createUtcIsoFromLocalDateTime,
} from "@/lib/dates";
import {
  scheduleTaskPushNotification,
  cancelTaskPushNotifications,
} from "@/lib/onesignal/client";

export async function fetchTasks(userId?: string): Promise<Task[]> {
  const supabase = createClient();
  let targetId = userId;

  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

export async function createDbTask(
  task: Omit<Task, "id" | "createdAt" | "updatedAt">,
): Promise<Task> {
  const supabase = createClient();
  let targetId = task.userId;

  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const taskOverrides = {
    ...(task.dateOverrides || {}),
    _enableReminders:
      task.enableReminders !== undefined ? task.enableReminders : false,
    _reminderOffsetMinutes:
      task.reminderOffsetMinutes !== undefined
        ? task.reminderOffsetMinutes
        : 10,
    _reminderTimes: task.reminderTimes || ["11:00", "18:00"],
  };

  const taskDate = (task as any).date || getTodayDateString();
  const createdIso = taskDate
    ? `${taskDate}T12:00:00.000Z`
    : new Date().toISOString();

  const utcStartTime = task.startTime
    ? convertLocalTimeToUtc(task.startTime, taskDate)
    : null;
  const utcEndTime = task.endTime
    ? convertLocalTimeToUtc(task.endTime, taskDate)
    : null;

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
    enableReminders:
      task.enableReminders !== undefined ? task.enableReminders : false,
    reminderOffsetMinutes:
      task.reminderOffsetMinutes !== undefined
        ? task.reminderOffsetMinutes
        : 10,
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
  userId?: string,
): Promise<Task> {
  const supabase = createClient();
  let targetId: string = userId || "";
  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const nowIso = new Date().toISOString();

  const currentOverrides = { ...(target?.dateOverrides || {}) };
  if (updates.date && currentOverrides[updates.date]?.skipped) {
    delete currentOverrides[updates.date];
  }

  const newOverrides = {
    ...currentOverrides,
    ...(updates.enableReminders !== undefined
      ? { _enableReminders: updates.enableReminders }
      : {}),
    ...(updates.reminderOffsetMinutes !== undefined
      ? { _reminderOffsetMinutes: updates.reminderOffsetMinutes }
      : {}),
    ...(updates.reminderTimes !== undefined
      ? { _reminderTimes: updates.reminderTimes }
      : {}),
  };

  const dbUpdates: any = {
    updated_at: nowIso,
    date_overrides: newOverrides,
  };

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined)
    dbUpdates.description = updates.description || null;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.startTime !== undefined)
    dbUpdates.start_time = updates.startTime
      ? convertLocalTimeToUtc(updates.startTime, updates.date)
      : null;
  if (updates.endTime !== undefined)
    dbUpdates.end_time = updates.endTime
      ? convertLocalTimeToUtc(updates.endTime, updates.date)
      : null;
  if (updates.deadline !== undefined)
    dbUpdates.deadline = updates.deadline || null;
  if (updates.priority !== undefined)
    dbUpdates.priority = updates.priority || "NORMAL";
  if (updates.recurrence !== undefined)
    dbUpdates.recurrence = updates.recurrence;
  if (updates.recurrenceConfig !== undefined)
    dbUpdates.recurrence_config = updates.recurrenceConfig;
  if (updates.trackingType !== undefined)
    dbUpdates.tracking_type = updates.trackingType;
  if (updates.targetValue !== undefined)
    dbUpdates.target_value = updates.targetValue;
  if (updates.unit !== undefined) dbUpdates.unit = updates.unit || null;
  if (updates.projectId !== undefined) {
    dbUpdates.project_id = updates.projectId || null;
    dbUpdates.project_status = updates.projectId
      ? updates.projectStatus || target?.projectStatus || "TODO"
      : null;
  } else if (updates.projectStatus !== undefined) {
    dbUpdates.project_status = updates.projectStatus || null;
  }
  if (
    updates.date !== undefined &&
    (updates.recurrence === "ONCE" || target?.recurrence === "ONCE")
  ) {
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
    description:
      updates.description !== undefined
        ? updates.description || null
        : baseTask.description,
    category:
      updates.category !== undefined ? updates.category : baseTask.category,
    startTime:
      updates.startTime !== undefined
        ? updates.startTime || null
        : baseTask.startTime,
    endTime:
      updates.endTime !== undefined ? updates.endTime || null : baseTask.endTime,
    deadline:
      updates.deadline !== undefined
        ? updates.deadline || null
        : baseTask.deadline,
    priority:
      updates.priority !== undefined
        ? updates.priority || "NORMAL"
        : baseTask.priority,
    recurrence:
      updates.recurrence !== undefined
        ? updates.recurrence
        : baseTask.recurrence,
    recurrenceConfig:
      updates.recurrenceConfig !== undefined
        ? updates.recurrenceConfig
        : baseTask.recurrenceConfig,
    trackingType:
      updates.trackingType !== undefined
        ? updates.trackingType
        : baseTask.trackingType,
    targetValue:
      updates.targetValue !== undefined
        ? updates.targetValue
        : baseTask.targetValue,
    unit: updates.unit !== undefined ? updates.unit || null : baseTask.unit,
    dateOverrides: newOverrides,
    enableReminders:
      updates.enableReminders !== undefined
        ? updates.enableReminders
        : baseTask.enableReminders ?? true,
    reminderOffsetMinutes:
      updates.reminderOffsetMinutes !== undefined
        ? updates.reminderOffsetMinutes
        : baseTask.reminderOffsetMinutes ?? 10,
    reminderTimes:
      updates.reminderTimes !== undefined
        ? updates.reminderTimes
        : baseTask.reminderTimes || ["11:00", "18:00"],
    projectId:
      updates.projectId !== undefined
        ? updates.projectId || null
        : baseTask.projectId,
    projectStatus:
      updates.projectId !== undefined
        ? updates.projectId
          ? updates.projectStatus || baseTask.projectStatus || "TODO"
          : null
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

export async function deleteDbTask(
  taskId: string,
  userId?: string,
): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
