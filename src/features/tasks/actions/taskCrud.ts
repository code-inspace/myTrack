import { Task, TaskCompletion, TaskFormValues } from "../types";
import { getEffectiveUserId } from "./user";
import { mapDbTaskToModel, mapDbTaskToModelAsync, TASKS_STORAGE_PREFIX } from "./mappers";
import { getStoredTasks, saveStoredTasks, getStoredCompletions, saveStoredCompletions } from "./storage";
import { upsertDbCompletion } from "./taskCompletions";
import { createClient } from "@/utils/supabase/client";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";
import {
  getTodayDateString,
  convertLocalTimeToUtc,
  createUtcIsoFromLocalDateTime,
} from "@/lib/dates";
import {
  scheduleTaskPushNotification,
  cancelTaskPushNotifications,
} from "@/lib/onesignal/client";
import {
  syncTaskWithSleepNaps,
  removeTaskFromSleepNaps,
} from "@/features/sleep/actions";
import { LiveActivityBridge } from "@/lib/native/liveActivity";

export async function fetchTasks(userId?: string): Promise<Task[]> {
  const supabase = createClient();
  let targetId = userId;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentAuthId = session?.user?.id;
  if (currentAuthId) {
    targetId = currentAuthId;
  } else if (!targetId) {
    targetId = getEffectiveUserId();
  }

  if (!targetId) return [];

  const local = getStoredTasks(targetId);

  try {
    // 1. Only push newly created offline tasks to server sync endpoint (ignore existing UUID tasks to prevent resurrecting deleted ones)
    const localCompletions = getStoredCompletions(targetId);
    const offlineTasks = local.filter((t) => t.id && t.id.startsWith("task-"));
    if (offlineTasks.length > 0) {
      const syncTasks = offlineTasks.map((t) => ({
        ...t,
        startTime: t.startTime ? convertLocalTimeToUtc(t.startTime, t.createdAt?.split("T")[0]) : null,
        endTime: t.endTime ? convertLocalTimeToUtc(t.endTime, t.createdAt?.split("T")[0]) : null,
      }));
      const syncCompletions = localCompletions.map((c) => ({
        ...c,
        scheduledStartTime: c.scheduledStartTime ? convertLocalTimeToUtc(c.scheduledStartTime, c.date) : null,
        scheduledEndTime: c.scheduledEndTime ? convertLocalTimeToUtc(c.scheduledEndTime, c.date) : null,
        actualStartTime: c.actualStartTime ? convertLocalTimeToUtc(c.actualStartTime, c.date) : null,
        actualEndTime: c.actualEndTime ? convertLocalTimeToUtc(c.actualEndTime, c.date) : null,
      }));
      fetch("/api/tasks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localTasks: syncTasks, localCompletions: syncCompletions, userId: targetId }),
      }).catch(() => {});
    }

    // 2. Fetch all fresh tasks from API route and map them to local device timezone
    const res = await fetch(`/api/tasks?userId=${encodeURIComponent(targetId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tasks)) {
        const mappedTasks = await Promise.all(
          data.tasks.map((t: any) => mapDbTaskToModelAsync(t))
        );
        saveStoredTasks(mappedTasks, targetId);
        return mappedTasks;
      }
    }
  } catch (err) {
    console.warn("API fetchTasks error, falling back to storage:", err);
  }

  return local;
}

export async function createDbTask(
  task: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Task> {
  const supabase = createClient();
  let targetId = task.userId;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentAuthId = session?.user?.id;
  if (currentAuthId) {
    targetId = currentAuthId;
  } else if (!targetId) {
    targetId = getEffectiveUserId();
  }

  const oldLocalId = task.id;
  const taskTag = task.tag || task.category || "General";
  const taskDate = (task as any).date || getTodayDateString();

  try {
    const taskPayload = {
      ...task,
      startTime: task.startTime ? convertLocalTimeToUtc(task.startTime, taskDate) : null,
      endTime: task.endTime ? convertLocalTimeToUtc(task.endTime, taskDate) : null,
    };
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: taskPayload, userId: targetId }),
    });

    if (res.ok) {
      const { task: rawCreated } = await res.json();
      if (rawCreated) {
        const created = mapDbTaskToModel(rawCreated);
        const current = getStoredTasks(targetId);
        const updated = [
          created,
          ...current.filter((t) => t.id !== created.id && t.id !== oldLocalId),
        ];
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

        syncTaskWithSleepNaps(created, taskDate).catch(() => {});

        return created;
      }
    }
  } catch (err) {
    console.warn("API createDbTask error fallback:", err);
  }

  // Local fallback
  const createdLocal: Task = {
    id: "task-" + Date.now(),
    userId: targetId,
    title: task.title,
    description: task.description || null,
    tag: taskTag,
    category: taskTag,
    startTime: task.startTime || null,
    endTime: task.endTime || null,
    deadline: task.deadline || null,
    priority: task.priority || "NORMAL",
    recurrence: task.recurrence,
    recurrenceConfig: task.recurrenceConfig || null,
    dateOverrides: task.dateOverrides || {},
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
    projectCategory: task.projectId ? task.projectCategory || null : null,
    createdAt: `${taskDate}T12:00:00.000Z`,
    updatedAt: new Date().toISOString(),
  };
  const current = getStoredTasks(targetId);
  const updated = [createdLocal, ...current];
  saveStoredTasks(updated, targetId);

  syncTaskWithSleepNaps(createdLocal, taskDate).catch(() => {});

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
    ...(updates.isNoProject !== undefined
      ? { _isNoProject: updates.isNoProject }
      : (updates.projectId ? { _isNoProject: false } : {})),
  };

  const taskDate = updates.date || (target?.createdAt ? target.createdAt.split("T")[0] : getTodayDateString());

  const utcStart = updates.startTime !== undefined
    ? (updates.startTime ? convertLocalTimeToUtc(updates.startTime, taskDate) : null)
    : undefined;
  const utcEnd = updates.endTime !== undefined
    ? (updates.endTime ? convertLocalTimeToUtc(updates.endTime, taskDate) : null)
    : undefined;

  const dbUpdates: any = {
    updated_at: nowIso,
    date_overrides: newOverrides,
  };

  if (updates.title !== undefined) {
    dbUpdates.title = await encryptText(updates.title);
  }
  if (updates.description !== undefined) {
    dbUpdates.description = updates.description ? await encryptText(updates.description) : null;
  }
  if (updates.tag !== undefined) {
    dbUpdates.tag = updates.tag;
    dbUpdates.category = updates.tag;
  } else if (updates.category !== undefined) {
    dbUpdates.tag = updates.category;
    dbUpdates.category = updates.category;
  }
  if (utcStart !== undefined) dbUpdates.start_time = utcStart;
  if (utcEnd !== undefined) dbUpdates.end_time = utcEnd;
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
    dbUpdates.project_category = updates.projectId
      ? updates.projectCategory !== undefined
        ? updates.projectCategory
        : target?.projectCategory || null
      : null;
  } else {
    if (updates.projectStatus !== undefined) {
      dbUpdates.project_status = updates.projectStatus || null;
    }
    if (updates.projectCategory !== undefined) {
      dbUpdates.project_category = updates.projectCategory || null;
    }
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
      const updated = await mapDbTaskToModelAsync(data);
      const nextList = tasks.map((t) => (t.id === taskId ? updated : t));
      saveStoredTasks(nextList, targetId);

      const targetDate = updates.date || getTodayDateString();
      const completions = getStoredCompletions(targetId);
      const isDoneOnDate = completions.some((c) => c.taskId === updated.id && c.date === targetDate && c.completed);
      const isTaskCompleted = isDoneOnDate || updated.projectStatus === "DONE";

      if (isTaskCompleted) {
        cancelTaskPushNotifications({
          taskId: updated.id,
          userId: targetId,
        }).catch(() => {});
      } else if (updated.enableReminders) {
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

      const napDate = updates.date || (target?.createdAt ? target.createdAt.split("T")[0] : undefined);
      const prevDate = target?.createdAt ? target.createdAt.split("T")[0] : undefined;
      syncTaskWithSleepNaps(updated, napDate, prevDate).catch(() => {});

      if (updates.startTime !== undefined || updates.endTime !== undefined) {
        try {
          const completions = getStoredCompletions(targetId);
          const compDate = targetDate || getTodayDateString();
          const existingComp = completions.find((c) => c.taskId === taskId && c.date === compDate);
          if (existingComp) {
            await upsertDbCompletion({
              taskId,
              userId: targetId,
              date: compDate,
              completed: existingComp.completed,
              value: existingComp.value,
              duration: existingComp.duration,
              scheduledStartTime: updated.startTime,
              scheduledEndTime: updated.endTime,
              actualStartTime: existingComp.completed ? updated.startTime : (existingComp.actualStartTime ? updated.startTime : null),
              actualEndTime: existingComp.completed ? updated.endTime : (existingComp.actualEndTime ? updated.endTime : null),
            });
          }
        } catch (compErr) {
          console.warn("updateDbTask completion sync error:", compErr);
        }
      }

      return updated;
    }
  } catch (err) {
    console.warn("Supabase client updateDbTask error, attempting /api/tasks PATCH fallback:", err);
  }

  // Server Admin API fallback for reliable persistence with UTC times
  try {
    const serverUpdates: any = {
      ...updates,
    };
    if (utcStart !== undefined) serverUpdates.startTime = utcStart;
    if (utcEnd !== undefined) serverUpdates.endTime = utcEnd;

    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, updates: serverUpdates, userId: targetId }),
    });
  } catch (apiErr) {
    console.warn("API updateDbTask PATCH error:", apiErr);
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
    tag:
      updates.tag !== undefined
        ? updates.tag
        : updates.category !== undefined
        ? updates.category
        : baseTask.tag || baseTask.category || "General",
    category:
      updates.tag !== undefined
        ? updates.tag
        : updates.category !== undefined
        ? updates.category
        : baseTask.tag || baseTask.category || "General",
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
        : baseTask.enableReminders ?? false,
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
    projectCategory:
      updates.projectCategory !== undefined
        ? updates.projectCategory || null
        : baseTask.projectCategory || null,
    isActive: baseTask.isActive,
    startedAt: baseTask.startedAt,
    isArchived: baseTask.isArchived,
    sortOrder: baseTask.sortOrder,
    createdAt:
      updates.date !== undefined &&
      (updates.recurrence === "ONCE" || baseTask.recurrence === "ONCE")
        ? `${updates.date}T12:00:00.000Z`
        : baseTask.createdAt,
    updatedAt: nowIso,
  };
  const nextList = target
    ? tasks.map((t) => (t.id === taskId ? updatedTask : t))
    : tasks;
  if (target) {
    saveStoredTasks(nextList, targetId);
  }

  const targetDate = updates.date || getTodayDateString();
  const completions = getStoredCompletions(targetId);
  const isDoneOnDate = completions.some((c) => c.taskId === updatedTask.id && c.date === targetDate && c.completed);
  const isTaskCompleted = isDoneOnDate || updatedTask.projectStatus === "DONE";

  if (isTaskCompleted) {
    cancelTaskPushNotifications({
      taskId: updatedTask.id,
      userId: targetId,
    }).catch(() => {});
  } else if (updatedTask.enableReminders) {
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

  const napDate = updates.date || (target?.createdAt ? target.createdAt.split("T")[0] : undefined);
  const prevDate = target?.createdAt ? target.createdAt.split("T")[0] : undefined;
  syncTaskWithSleepNaps(updatedTask, napDate, prevDate).catch(() => {});

  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    try {
      const completions = getStoredCompletions(targetId);
      const compDate = targetDate || getTodayDateString();
      const existingComp = completions.find((c) => c.taskId === taskId && c.date === compDate);
      if (existingComp) {
        await upsertDbCompletion({
          taskId,
          userId: targetId,
          date: compDate,
          completed: existingComp.completed,
          value: existingComp.value,
          duration: existingComp.duration,
          scheduledStartTime: updatedTask.startTime,
          scheduledEndTime: updatedTask.endTime,
          actualStartTime: existingComp.completed ? updatedTask.startTime : (existingComp.actualStartTime ? updatedTask.startTime : null),
          actualEndTime: existingComp.completed ? updatedTask.endTime : (existingComp.actualEndTime ? updatedTask.endTime : null),
        });
      }
    } catch (compErr) {
      console.warn("updateDbTask completion fallback sync error:", compErr);
    }
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

  // 1. Clean local tasks storage across all keys immediately to prevent race condition resurrection
  const tasks = getStoredTasks(targetId);
  const updatedTasks = tasks.filter((t) => t.id !== taskId);
  saveStoredTasks(updatedTasks, targetId);

  // 2. Clean local completions
  const comps = getStoredCompletions(targetId);
  const updatedComps = comps.filter((c) => c.taskId !== taskId);
  saveStoredCompletions(updatedComps, targetId);

  // Also purge from legacy storage keys if present
  if (typeof window !== "undefined") {
    const legacyKeys = [
      TASKS_STORAGE_PREFIX + "00000000-0000-0000-0000-000000000001",
      "mytrack_tasks_v1",
      "mytrack_tasks",
      "tasks",
    ];
    for (const k of legacyKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localStorage.setItem(
              k,
              JSON.stringify(parsed.filter((t: any) => t.id !== taskId))
            );
          }
        } catch {}
      }
    }
  }

  // 3. Cancel any pending push notifications for this task before removing it
  await cancelTaskPushNotifications({
    taskId,
    userId: targetId,
  }).catch(() => {});

  // Stop any active Live Activity for this task
  try {
    await LiveActivityBridge.stopActivity(taskId);
  } catch {}

  // Remove corresponding nap from sleep log if any
  removeTaskFromSleepNaps(taskId, undefined, targetId).catch(() => {});

  // 4. Delete from server admin endpoint for reliable backend persistence (bypasses any RLS constraints)
  try {
    await fetch(`/api/tasks?id=${encodeURIComponent(taskId)}&userId=${encodeURIComponent(targetId || "")}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("API deleteDbTask error:", err);
  }

  // 5. Delete from Supabase client directly
  try {
    await supabase.from("task_completions").delete().eq("task_id", taskId);
    await supabase.from("reminders").delete().eq("task_id", taskId);
    await supabase.from("notification_schedules").delete().eq("task_id", taskId);
    await supabase.from("tasks").delete().eq("id", taskId);
  } catch (supabaseErr) {
    console.warn("Supabase client deleteDbTask note:", supabaseErr);
  }
}
