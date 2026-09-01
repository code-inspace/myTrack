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
} from "@/lib/dates";
import { getStoredProjects } from "@/features/projects/actions";
import { getProjectColumns, DEFAULT_PROJECT_COLUMNS } from "@/features/projects/types";

export async function fetchCompletions(
  userId?: string,
): Promise<TaskCompletion[]> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  const local = getStoredCompletions(targetId);

  try {
    const { data, error } = await supabase
      .from("task_completions")
      .select("*")
      .eq("user_id", targetId);

    if (!error && data) {
      const mapped = data.map(mapDbCompletionToModel);
      const mergedMap = new Map<string, TaskCompletion>();
      for (const item of local) {
        mergedMap.set(`${item.taskId}_${item.date}`, item);
      }
      for (const item of mapped) {
        mergedMap.set(`${item.taskId}_${item.date}`, item);
      }
      const merged = Array.from(mergedMap.values());
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (err) {
    console.warn("Supabase fetchCompletions error:", err);
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

  // 2. Persist to Supabase if valid UUID
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (isValidUuid.test(completion.taskId) && isValidUuid.test(targetId)) {
    const baseRecord = {
      task_id: completion.taskId,
      user_id: targetId,
      date: completion.date,
      completed: completion.completed,
      value: completion.value !== undefined ? completion.value : null,
      duration: completion.duration !== undefined ? completion.duration : null,
      notes: completion.notes || null,
    };

    const extendedRecord = {
      ...baseRecord,
      scheduled_start_time: completion.scheduledStartTime
        ? convertLocalTimeToUtc(
            completion.scheduledStartTime,
            completion.date,
          )
        : null,
      scheduled_end_time: completion.scheduledEndTime
        ? convertLocalTimeToUtc(
            completion.scheduledEndTime,
            completion.date,
          )
        : null,
      actual_start_time: completion.actualStartTime
        ? convertLocalTimeToUtc(
            completion.actualStartTime,
            completion.date,
          )
        : null,
      actual_end_time: completion.actualEndTime
        ? convertLocalTimeToUtc(completion.actualEndTime, completion.date)
        : null,
    };

    try {
      const { error } = await supabase
        .from("task_completions")
        .upsert([extendedRecord], { onConflict: "task_id,date" });

      if (error) {
        const fallback = await supabase
          .from("task_completions")
          .upsert([baseRecord], { onConflict: "task_id,date" });
        if (fallback.error) {
          console.warn("Supabase upsertDbCompletion fallback note:", fallback.error);
        }
      }
    } catch (err) {
      console.warn("Supabase upsertDbCompletion error:", err);
    }
  }
}

/**
 * Marks a task as completed "now". If it had no schedule or was not started yet,
 * records a 30-minute block ending now and reflects that window in the Agenda for that day.
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
  const actualStartTime = wasStarted
    ? existing!.actualStartTime!
    : target?.startTime || subtractMinutesFromTime(nowTime, 30);
  const actualEndTime = existing?.actualEndTime || nowTime;

  // If the task had no explicit time or was unstarted, position this day's occurrence in the Agenda timeline
  if (!wasStarted) {
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
    scheduledStartTime:
      target?.startTime || existing?.scheduledStartTime || actualStartTime,
    scheduledEndTime: target?.endTime || existing?.scheduledEndTime || actualEndTime,
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

  if (target.projectId) {
    let project = getStoredProjects(userId).find((p) => p.id === target?.projectId);
    if (!project) {
      try {
        const { data } = await supabase.from("projects").select("*").eq("id", target.projectId).single();
        if (data) {
          project = {
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
    }

    const columns = project ? getProjectColumns(project) : DEFAULT_PROJECT_COLUMNS;
    const doneColumn =
      columns.find((c) => c.isDone) ||
      columns[columns.length - 1] ||
      DEFAULT_PROJECT_COLUMNS[DEFAULT_PROJECT_COLUMNS.length - 1];

    if (doneColumn && target.projectStatus !== doneColumn.id) {
      await updateDbTask(taskId, { projectStatus: doneColumn.id }, userId);
    }
  } else {
    if (target.projectStatus !== "DONE") {
      await updateDbTask(taskId, { projectStatus: "DONE" }, userId);
    }
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
      scheduledStartTime:
        target?.startTime || existing?.scheduledStartTime || null,
      scheduledEndTime: target?.endTime || existing?.scheduledEndTime || null,
      actualStartTime: null,
      actualEndTime: null,
      notes: null,
    });
  }

  // Dragging a Kanban card out of "done" already sets its new column explicitly — only the
  // habit-list/agenda reopen flow should jump the task back to the board's first column.
  if (!options?.skipProjectStatusReset && target?.projectId) {
    let project = getStoredProjects(targetId).find(
      (p) => p.id === target?.projectId,
    );
    if (!project) {
      try {
        const { data } = await supabase.from("projects").select("*").eq("id", target.projectId).single();
        if (data) {
          project = {
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
    }
    const columns = project ? getProjectColumns(project) : DEFAULT_PROJECT_COLUMNS;
    const firstColumn = columns[0] || DEFAULT_PROJECT_COLUMNS[0];
    if (firstColumn && target.projectStatus !== firstColumn.id) {
      await updateDbTask(taskId, { projectStatus: firstColumn.id }, targetId);
    }
  } else if (!options?.skipProjectStatusReset && !target?.projectId) {
    if (target && target.projectStatus === "DONE") {
      await updateDbTask(taskId, { projectStatus: "TODO" }, targetId);
    }
  }
}

