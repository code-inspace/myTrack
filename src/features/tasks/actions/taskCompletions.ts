import { TaskCompletion } from "../types";
import { getEffectiveUserId } from "./user";
import { mapDbCompletionToModel, mapDbTaskToModel, COMPLETIONS_STORAGE_PREFIX } from "./mappers";
import {
  getStoredTasks,
  getStoredCompletions,
  saveStoredCompletions,
} from "./storage";
import { updateDbTask } from "./taskCrud";
import { updateTaskSchedule } from "./taskSchedule";
import { createClient } from "@/utils/supabase/client";
import {
  convertLocalTimeToUtc,
  subtractMinutesFromTime,
  addHoursToTimeString,
} from "@/lib/dates";
import { cancelTaskPushNotifications } from "@/lib/onesignal/client";
import { getStoredProjects } from "@/features/projects/actions";
import {
  getDoneColumnId,
  getFirstColumnId,
  NO_PROJECT_DONE_STATUS,
  NO_PROJECT_TODO_STATUS,
  Project,
} from "@/features/projects/types";
import { getDefaultTaskDurationMinutes } from "../durationRules";

async function findProject(projectId: string, userId: string): Promise<Project | undefined> {
  const local = getStoredProjects(userId).find((p) => p.id === projectId);
  if (local) return local;
  try {
    const supabase = createClient();
    const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (data) {
      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        color: data.color || "#D4F63D",
        columns: Array.isArray(data.columns) ? data.columns : [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function fetchCompletions(
  userId?: string,
): Promise<TaskCompletion[]> {
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

  const local = getStoredCompletions(targetId);
  // Completions of local-only tasks ("task-…", not yet on the server) must survive a refresh
  const withLocalOnly = (serverCompletions: TaskCompletion[]): TaskCompletion[] => {
    const pending = local.filter(
      (c) => c.taskId?.startsWith("task-") && !serverCompletions.some((s) => s.taskId === c.taskId && s.date === c.date),
    );
    return pending.length > 0 ? [...serverCompletions, ...pending] : serverCompletions;
  };

  try {
    // 1. Query directly via Supabase client if authenticated
    try {
      const { data: dbCompletions, error } = await supabase
        .from("task_completions")
        .select("*")
        .eq("user_id", targetId);

      if (!error && Array.isArray(dbCompletions) && dbCompletions.length > 0) {
        const mapped = withLocalOnly(dbCompletions.map((c: any) => mapDbCompletionToModel(c)));
        saveStoredCompletions(mapped, targetId);
        return mapped;
      }
    } catch (sbErr) {
      console.warn("Direct Supabase fetchCompletions note:", sbErr);
    }

    // Fallback to API route if direct query returned empty or failed
    const res = await fetch(`/api/completions?userId=${encodeURIComponent(targetId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.completions)) {
        const mapped = withLocalOnly(data.completions.map((c: any) => mapDbCompletionToModel(c)));
        saveStoredCompletions(mapped, targetId);
        return mapped;
      }
    }
  } catch (err) {
    console.warn("fetchCompletions error, falling back to storage:", err);
  }

  return local;
}

export async function upsertDbCompletion(
  completion: Omit<TaskCompletion, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): Promise<void> {
  const supabase = createClient();
  let targetId = completion.userId;
  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  // 1. Immediately persist to localStorage synchronously
  const completions = getStoredCompletions(targetId);
  const existingIdx = completions.findIndex(
    (c) => c.taskId === completion.taskId && c.date === completion.date,
  );

  let updated: TaskCompletion[];
  if (existingIdx >= 0) {
    updated = [...completions];
    updated[existingIdx] = {
      ...updated[existingIdx],
      completed: completion.completed,
      value:
        completion.value !== undefined
          ? completion.value
          : updated[existingIdx].value,
      duration:
        completion.duration !== undefined
          ? completion.duration
          : updated[existingIdx].duration,
      scheduledStartTime:
        completion.scheduledStartTime !== undefined
          ? completion.scheduledStartTime
          : updated[existingIdx].scheduledStartTime,
      scheduledEndTime:
        completion.scheduledEndTime !== undefined
          ? completion.scheduledEndTime
          : updated[existingIdx].scheduledEndTime,
      actualStartTime:
        completion.actualStartTime !== undefined
          ? completion.actualStartTime
          : updated[existingIdx].actualStartTime,
      actualEndTime:
        completion.actualEndTime !== undefined
          ? completion.actualEndTime
          : updated[existingIdx].actualEndTime,
      updatedAt: new Date().toISOString(),
    };
  } else {
    const newRecord: TaskCompletion = {
      ...completion,
      id: completion.id || "comp-" + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updated = [newRecord, ...completions];
  }

  saveStoredCompletions(updated, targetId);

  // 2. Persist to API endpoint
  try {
    const dbPayload = {
      ...completion,
      scheduledStartTime: completion.scheduledStartTime
        ? convertLocalTimeToUtc(completion.scheduledStartTime, completion.date)
        : null,
      scheduledEndTime: completion.scheduledEndTime
        ? convertLocalTimeToUtc(completion.scheduledEndTime, completion.date)
        : null,
      actualStartTime: completion.actualStartTime
        ? convertLocalTimeToUtc(completion.actualStartTime, completion.date)
        : null,
      actualEndTime: completion.actualEndTime
        ? convertLocalTimeToUtc(completion.actualEndTime, completion.date)
        : null,
    };

    await fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completion: dbPayload, userId: targetId }),
    });

    // If marked as completed, immediately cancel any scheduled push notifications
    if (completion.completed) {
      cancelTaskPushNotifications({
        taskId: completion.taskId,
        userId: targetId,
      }).catch((e) => console.warn("Cancel push notifications note on completed:", e));
    }
  } catch (err) {
    console.warn("API upsertDbCompletion error:", err);
  }
}

/**
 * Marks a task as completed. If it already has an end time indicated, preserves it.
 * Never sets the end time to 'now' if an end time is already known.
 * Idempotent — safe to call on an already-completed task.
 */
export async function closeTaskAsCompleted(
  taskId: string,
  date: string,
  userId?: string,
  options?: { value?: number | null; duration?: number | null },
): Promise<void> {
  const supabase = createClient();
  const session = !userId
    ? (await supabase.auth.getSession()).data.session
    : null;
  const targetId: string = userId || session?.user?.id || getEffectiveUserId();

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const completions = getStoredCompletions(targetId);
  const existing = completions.find(
    (c) => c.taskId === taskId && c.date === date,
  );

  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const wasStarted = Boolean(existing?.actualStartTime);

  const effectiveStart =
    target?.dateOverrides?.[date]?.startTime !== undefined
      ? target.dateOverrides[date].startTime
      : target?.startTime;

  const effectiveEnd =
    target?.dateOverrides?.[date]?.endTime !== undefined
      ? target.dateOverrides[date].endTime
      : target?.endTime;

  // Same default block length everywhere (task target duration, else 60 min).
  const defaultMinutes = getDefaultTaskDurationMinutes(target);
  const actualStartTime = wasStarted
    ? existing!.actualStartTime!
    : effectiveStart || existing?.scheduledStartTime || subtractMinutesFromTime(nowTime, defaultMinutes);

  // CRITICAL: NEVER set end time to nowTime if an end time is already indicated on the task / override / completion
  const actualEndTime =
    existing?.actualEndTime ||
    effectiveEnd ||
    existing?.scheduledEndTime ||
    (effectiveStart ? addHoursToTimeString(effectiveStart, defaultMinutes / 60) : nowTime);

  const scheduledStartTime =
    effectiveStart || existing?.scheduledStartTime || actualStartTime;
  const scheduledEndTime =
    effectiveEnd || existing?.scheduledEndTime || actualEndTime;

  // ONLY if the task had NO explicit schedule anywhere and was unstarted, position this day's occurrence in the Agenda timeline
  if (!wasStarted && !effectiveStart && !effectiveEnd) {
    const isRecurring = target?.recurrence && target.recurrence !== "ONCE";
    await updateTaskSchedule({
      taskId,
      date,
      startTime: actualStartTime,
      endTime: actualEndTime,
      applyToAll: !isRecurring,
      userId: targetId,
    });
  }

  await upsertDbCompletion({
    taskId,
    userId: targetId,
    date,
    completed: true,
    value:
      options?.value !== undefined ? options.value : existing?.value || null,
    duration:
      options?.duration !== undefined
        ? options.duration
        : existing?.duration || null,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    notes: null,
  });

  await syncProjectStatusToDoneColumn(taskId, targetId);
}

/**
 * A completed task that belongs to a project also moves onto that project's Kanban board's
 * "done" column, regardless of which screen (habit list, agenda, voice) it was completed from.
 */
export async function syncProjectStatusToDoneColumn(
  taskId: string,
  userId: string,
): Promise<void> {
  const supabase = createClient();
  let target = getStoredTasks(userId).find((t) => t.id === taskId);
  if (!target) {
    try {
      const { data } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (data) target = mapDbTaskToModel(data);
    } catch {
      // ignore
    }
  }
  if (!target) return;

  // Tasks without a project use the plain "DONE" status of the "no project" board.
  const project = target.projectId ? await findProject(target.projectId, userId) : undefined;
  const doneStatus = target.projectId ? getDoneColumnId(project || { columns: [] }) : NO_PROJECT_DONE_STATUS;
  if (target.projectStatus !== doneStatus) {
    await updateDbTask(taskId, { projectStatus: doneStatus }, userId);
  }
}

/**
 * Un-completes a task (e.g. re-opening it from the habit list or agenda or dragging it out of Done).
 * When dragged out of Done or reopened, all completion records are cleared and project status is reset.
 */
export async function reopenTaskAsIncomplete(
  taskId: string,
  date: string,
  userId?: string,
  options?: {
    value?: number | null;
    duration?: number | null;
    skipProjectStatusReset?: boolean;
    reopenAllDates?: boolean;
  },
): Promise<void> {
  const supabase = createClient();
  const session = !userId
    ? (await supabase.auth.getSession()).data.session
    : null;
  const targetId: string = userId || session?.user?.id || getEffectiveUserId();

  let tasks = getStoredTasks(targetId);
  let target = tasks.find((t) => t.id === taskId);
  if (!target) {
    try {
      const { data } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (data) target = mapDbTaskToModel(data);
    } catch {
      // ignore
    }
  }
  const completions = getStoredCompletions(targetId);

  // If reopenAllDates is true (e.g. dragged out of Done column), clear/uncomplete all records for this task
  if (options?.reopenAllDates) {
    const updated = completions.map((c) =>
      c.taskId === taskId
        ? {
            ...c,
            completed: false,
            actualStartTime: null,
            actualEndTime: null,
            duration: null,
            updatedAt: new Date().toISOString(),
          }
        : c,
    );
    saveStoredCompletions(updated, targetId);

    try {
      await supabase
        .from("task_completions")
        .update({
          completed: false,
          actual_start_time: null,
          actual_end_time: null,
          duration: null,
          updated_at: new Date().toISOString(),
        })
        .eq("task_id", taskId)
        .eq("user_id", targetId);
    } catch (err) {
      console.warn("Supabase reopenTaskAsIncomplete all dates error:", err);
    }
  } else {
    const existing = completions.find(
      (c) => c.taskId === taskId && c.date === date,
    );

    await upsertDbCompletion({
      taskId,
      userId: targetId,
      date,
      completed: false,
      value:
        options?.value !== undefined ? options.value : existing?.value || null,
      duration: options?.duration !== undefined ? options.duration : null,
      // Same effective schedule as closeTaskAsCompleted: the date override wins over the task times.
      scheduledStartTime:
        (target?.dateOverrides?.[date]?.startTime !== undefined
          ? target.dateOverrides[date].startTime
          : target?.startTime) ||
        existing?.scheduledStartTime ||
        null,
      scheduledEndTime:
        (target?.dateOverrides?.[date]?.endTime !== undefined
          ? target.dateOverrides[date].endTime
          : target?.endTime) ||
        existing?.scheduledEndTime ||
        null,
      actualStartTime: null,
      actualEndTime: null,
      notes: null,
    });
  }

  // Dragging a Kanban card out of "done" already sets its new column explicitly — only the
  // habit-list/agenda reopen flow should jump the task back to the board's first column.
  if (!options?.skipProjectStatusReset && target) {
    const isRecurring = target.recurrence && target.recurrence !== "ONCE";
    // Reopening one occurrence of a recurring habit doesn't move its card, unless it sat in done.
    const project = target.projectId ? await findProject(target.projectId, targetId) : undefined;
    const doneStatus = target.projectId ? getDoneColumnId(project || { columns: [] }) : NO_PROJECT_DONE_STATUS;
    const reopenStatus = target.projectId ? getFirstColumnId(project || { columns: [] }) : NO_PROJECT_TODO_STATUS;
    const shouldReset =
      target.projectStatus === doneStatus || options?.reopenAllDates || (!isRecurring && Boolean(target.projectId));
    if (shouldReset && target.projectStatus !== reopenStatus) {
      await updateDbTask(taskId, { projectStatus: reopenStatus }, targetId);
    }
  }
}

