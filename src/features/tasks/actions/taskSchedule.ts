import { getEffectiveUserId } from "./user";
import {
  getStoredTasks,
  saveStoredTasks,
  getStoredCompletions,
  saveStoredCompletions,
} from "./storage";

import { upsertDbCompletion } from "./taskCompletions";
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
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { serializeDateOverridesForDb } from "./mappers";
import { getDefaultTaskDurationMinutes, getCompletionFieldsAfterReschedule } from "../durationRules";
import { isTaskInDoneColumn } from "@/features/projects/types";
import { getStoredProjects } from "@/features/projects/actions";

export async function updateDbTaskActive(
  taskId: string,
  isActive: boolean,
  userId?: string,
): Promise<void> {
  let targetId = userId;
  if (!targetId) {
    targetId = getEffectiveUserId();
  }

  const nowIso = new Date().toISOString();

  // 1. Immediately update localStorage for instant UI reactivity
  const tasks = getStoredTasks(targetId);
  
  // If activating, ensure we have at most 2 active tasks (keep the newest previous active task, deactivate older ones)
  let deactivatedTaskIds: string[] = [];
  if (isActive) {
    const otherActiveTasks = tasks
      .filter((t) => t.id !== taskId && t.isActive)
      .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
    
    if (otherActiveTasks.length >= 2) {
      deactivatedTaskIds = otherActiveTasks.slice(1).map((t) => t.id);
    }
  }

  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        isActive,
        startedAt: isActive ? nowIso : null,
        updatedAt: nowIso,
      };
    }
    if (deactivatedTaskIds.includes(t.id)) {
      return {
        ...t,
        isActive: false,
        startedAt: null,
        updatedAt: nowIso,
      };
    }
    return t;
  });
  saveStoredTasks(updated, targetId);

  // 2. Persist to server via robust PATCH API route
  try {
    fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        userId: targetId,
        updates: {
          isActive,
          startedAt: isActive ? nowIso : null,
        },
      }),
    }).catch((err) => console.warn("API updateDbTaskActive PATCH note:", err));

    // Also deactivate any older tasks exceeding limit
    for (const dId of deactivatedTaskIds) {
      fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: dId,
          userId: targetId,
          updates: {
            isActive: false,
            startedAt: null,
          },
        }),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("updateDbTaskActive error:", err);
  }
}

export async function updateDbTaskStartedAt(
  taskId: string,
  startedAtTime: string,
  userId?: string,
): Promise<{ startedAt: string }> {
  let targetId = userId;
  if (!targetId) {
    targetId = getEffectiveUserId();
  }

  const now = new Date();
  const [hours, minutes] = startedAtTime
    .split(":")
    .map((v) => parseInt(v, 10) || 0);
  const newStartDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
  );
  const newStartedAtIso = newStartDate.toISOString();
  const nowIso = now.toISOString();
  const todayStr = getTodayDateString();

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const isRecurring = target?.recurrence && target.recurrence !== "ONCE";

  // Provisional end: the task's own end time, else the shared default block length
  let provisionalEndTime = target?.endTime;
  if (!provisionalEndTime) {
    const endMinutes = (hours * 60 + minutes + getDefaultTaskDurationMinutes(target)) % (24 * 60);
    provisionalEndTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  }

  const utcStartTime = convertLocalTimeToUtc(startedAtTime, todayStr);
  const utcProvisionalEndTime = provisionalEndTime
    ? convertLocalTimeToUtc(provisionalEndTime, todayStr)
    : null;

  // Overrides are local times in the app; serialized to UTC (all dates, not just today) for the DB.
  const currentOverrides = target?.dateOverrides || {};
  const localOverrides = {
    ...currentOverrides,
    [todayStr]: {
      ...(currentOverrides[todayStr] || {}),
      startTime: startedAtTime,
      endTime: provisionalEndTime,
    },
  };
  const updatedOverrides = serializeDateOverridesForDb(localOverrides);

  // 1. Synchronously update local tasks storage
  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        startedAt: newStartedAtIso,
        startTime: !isRecurring ? startedAtTime : t.startTime,
        endTime: !isRecurring ? provisionalEndTime : t.endTime,
        dateOverrides: localOverrides,
        updatedAt: nowIso,
      };
    }
    return t;
  });
  saveStoredTasks(updated, targetId);

  // 2. Synchronously update local completions storage
  const completions = getStoredCompletions(targetId);
  const compIdx = completions.findIndex(
    (c) => c.taskId === taskId && c.date === todayStr,
  );
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

  // 3. Persist to server via /api/tasks PATCH endpoint
  const serverUpdates: any = {
    startedAt: newStartedAtIso,
    dateOverrides: updatedOverrides,
  };
  if (!isRecurring) {
    serverUpdates.startTime = utcStartTime;
    serverUpdates.endTime = utcProvisionalEndTime;
  }
  try {
    fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        userId: targetId,
        updates: serverUpdates,
      }),
    }).catch((err) => console.warn("API updateDbTaskStartedAt PATCH note:", err));
  } catch (err) {
    console.warn("updateDbTaskStartedAt fetch error:", err);
  }

  // 4. Persist to server /api/completions endpoint
  try {
    fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completion: {
          taskId,
          userId: targetId,
          date: todayStr,
          completed: false,
          scheduledStartTime: utcStartTime,
          actualStartTime: utcStartTime,
        },
        userId: targetId,
      }),
    }).catch((err) => console.warn("API updateDbTaskStartedAt completion POST note:", err));
  } catch (err) {
    console.warn("updateDbTaskStartedAt completion error:", err);
  }

  // 5. Update Live Activity on iOS with recalculated elapsed time
  try {
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - newStartDate.getTime()) / 1000));
    LiveActivityBridge.updateActivity(taskId, {
      startedAtTimestamp: Math.floor(newStartDate.getTime() / 1000),
      elapsedSeconds,
    }).catch(() => {});
  } catch {}

  return { startedAt: newStartedAtIso };
}

/**
 * Updates schedule for a specific date (or globally).
 * If task is recurring and not applyToAll, saves to dateOverrides[date].
 */
export async function updateTaskSchedule({
  taskId,
  date,
  originDate,
  startTime,
  endTime,
  applyToAll = false,
  userId,
}: {
  taskId: string;
  date: string;
  originDate?: string;
  startTime: string | null;
  endTime: string | null;
  applyToAll?: boolean;
  userId?: string;
}): Promise<void> {
  const supabase = createClient();
  let targetId: string = userId || "";
  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  let target = tasks.find((t) => t.id === taskId);
  if (!target) {
    const fallbackTasks = getStoredTasks();
    target = fallbackTasks.find((t) => t.id === taskId);
  }
  const nowIso = new Date().toISOString();

  const isRecurring = target?.recurrence && target.recurrence !== "ONCE";
  const utcStart = startTime ? convertLocalTimeToUtc(startTime, date) : null;
  const utcEnd = endTime ? convertLocalTimeToUtc(endTime, date) : null;

  if (!isRecurring) {
    // For a ONCE task, updating schedule for a date also moves the task occurrence to that target date!
    const createdIso = `${date}T12:00:00.000Z`;

    try {
      await supabase
        .from("tasks")
        .update({
          start_time: utcStart,
          end_time: utcEnd,
          created_at: createdIso,
          updated_at: nowIso,
        })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule ONCE error:", err);
    }

    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: targetId,
          updates: {
            startTime: utcStart,
            endTime: utcEnd,
            createdAt: createdIso,
            date,
          },
        }),
      });
    } catch (err) {
      console.warn("API updateTaskSchedule ONCE error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            startTime,
            endTime,
            date,
            createdAt: createdIso,
            updatedAt: nowIso,
          }
        : t,
    );
    saveStoredTasks(updated, targetId);
  } else if (isRecurring && !applyToAll) {
    // Specific day override (local times in the app, UTC in the DB)
    const currentOverrides = target?.dateOverrides || {};
    const localOverrides: Record<string, any> = {
      ...currentOverrides,
      ...(originDate && originDate !== date ? { [originDate]: { skipped: true } } : {}),
      [date]: { startTime, endTime },
    };
    const updatedOverrides = serializeDateOverridesForDb(localOverrides);

    try {
      await supabase
        .from("tasks")
        .update({
          date_overrides: updatedOverrides,
          updated_at: nowIso,
        })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule override error:", err);
    }

    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: targetId,
          updates: {
            dateOverrides: updatedOverrides,
          },
        }),
      });
    } catch (err) {
      console.warn("API updateTaskSchedule override error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            dateOverrides: localOverrides,
            updatedAt: nowIso,
          }
        : t,
    );
    saveStoredTasks(updated, targetId);
  } else {
    // Global schedule update
    try {
      await supabase
        .from("tasks")
        .update({
          start_time: utcStart,
          end_time: utcEnd,
          updated_at: nowIso,
        })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule global error:", err);
    }

    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: targetId,
          updates: {
            startTime: utcStart,
            endTime: utcEnd,
          },
        }),
      });
    } catch (err) {
      console.warn("API updateTaskSchedule global error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, startTime, endTime, updatedAt: nowIso } : t,
    );
    saveStoredTasks(updated, targetId);
  }

  // Reschedule or cancel push notification for this task
  const completions = getStoredCompletions(targetId);
  const isDoneOnDate = completions.some((c) => c.taskId === taskId && c.date === date && c.completed);
  const isRecurringTask = Boolean(target?.recurrence && target.recurrence !== "ONCE");
  const isTaskCompleted =
    isDoneOnDate ||
    (!isRecurringTask && Boolean(target) && isTaskInDoneColumn(target!, getStoredProjects(targetId)));

  if (isTaskCompleted) {
    if (target) {
      cancelTaskPushNotifications({
        taskId: target.id,
        userId: targetId,
      }).catch(() => {});
    }
  } else if (target && Boolean(target.enableReminders)) {
    const scheduledIso = startTime
      ? createUtcIsoFromLocalDateTime(startTime, date)
      : undefined;
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

  // Existing completions follow the moved/resized block (see getCompletionFieldsAfterReschedule)
  try {
    const completions = getStoredCompletions(targetId);
    if (originDate && originDate !== date) {
      const oldComp = completions.find((c) => c.taskId === taskId && c.date === originDate);
      if (oldComp) {
        const filtered = completions.filter((c) => !(c.taskId === taskId && c.date === originDate));
        saveStoredCompletions(filtered, targetId);
        try {
          await supabase.from("task_completions").delete().eq("task_id", taskId).eq("date", originDate);
        } catch {}
        await upsertDbCompletion({
          taskId,
          userId: targetId,
          date,
          completed: oldComp.completed,
          value: oldComp.value,
          ...getCompletionFieldsAfterReschedule(oldComp, startTime, endTime),
        });
      }
    }

    const existingComp = completions.find((c) => c.taskId === taskId && c.date === date);
    if (existingComp) {
      await upsertDbCompletion({
        taskId,
        userId: targetId,
        date,
        completed: existingComp.completed,
        value: existingComp.value,
        ...getCompletionFieldsAfterReschedule(existingComp, startTime, endTime),
      });
    }
  } catch (e) {
    console.warn("updateTaskSchedule completion update note:", e);
  }
}

/**
 * Persists a new drag-and-drop priority order for a set of tasks (0..n-1 by array position).
 */
export async function updateTaskSortOrder(
  taskIds: string[],
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

  const nowIso = new Date().toISOString();

  try {
    await Promise.all(
      taskIds.map((taskId, index) =>
        supabase
          .from("tasks")
          .update({ sort_order: index, updated_at: nowIso })
          .eq("id", taskId),
      )
    );
  } catch (err) {
    console.warn("Supabase updateTaskSortOrder error:", err);
  }

  const tasks = getStoredTasks(targetId);
  const orderMap = new Map(taskIds.map((id, index) => [id, index]));
  const updated = tasks.map((t) =>
    orderMap.has(t.id)
      ? { ...t, sortOrder: orderMap.get(t.id)!, updatedAt: nowIso }
      : t,
  );
  saveStoredTasks(updated, targetId);
}

/**
 * Moves a single occurrence of a task from one date to another (used by drag-and-drop onto the day strip),
 * keeping its times. Same path as an agenda move (updateTaskSchedule): a ONCE task changes date, a
 * recurring task gets its origin date "skipped" and an override on the destination — and in both
 * cases the completion and reminders follow the occurrence.
 */
export async function moveTaskOccurrence(
  taskId: string,
  fromDate: string,
  toDate: string,
  userId?: string,
): Promise<void> {
  if (fromDate === toDate) return;

  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return;

  const currentOverrides = target.dateOverrides || {};
  const carriedStart =
    target.recurrence !== "ONCE" && currentOverrides[fromDate]?.startTime !== undefined
      ? currentOverrides[fromDate].startTime
      : target.startTime ?? null;
  const carriedEnd =
    target.recurrence !== "ONCE" && currentOverrides[fromDate]?.endTime !== undefined
      ? currentOverrides[fromDate].endTime
      : target.endTime ?? null;

  await updateTaskSchedule({
    taskId,
    date: toDate,
    originDate: fromDate,
    startTime: carriedStart,
    endTime: carriedEnd,
    applyToAll: false,
    userId: targetId,
  });
}
