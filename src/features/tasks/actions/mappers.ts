import { Task, TaskCompletion } from "../types";
import { convertUtcTimeToLocal, convertLocalTimeToUtc } from "@/lib/dates";
import { isEncrypted, decryptText } from "@/lib/crypto/encryption";

export const TASKS_STORAGE_PREFIX = "mytrack_tasks_";
export const COMPLETIONS_STORAGE_PREFIX = "mytrack_completions_";

// Convert Supabase snake_case or camelCase task row to Task with local timezone conversion
export function mapDbTaskToModel(row: any): Task {
  const rawOverrides = row.dateOverrides || row.date_overrides || {};
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

  const taskDate = (row.createdAt || row.created_at) ? String(row.createdAt || row.created_at).split("T")[0] : undefined;

  return {
    id: row.id,
    userId: row.user_id || row.userId,
    date: taskDate,
    title: row.title,
    description: row.description || null,
    tag: row.tag || row.category || rawOverrides._tag || "General",
    category: row.tag || row.category || rawOverrides._tag || "General",
    startTime: row.startTime
      ? convertUtcTimeToLocal(row.startTime, taskDate)
      : row.start_time
      ? convertUtcTimeToLocal(row.start_time, taskDate)
      : null,
    endTime: row.endTime
      ? convertUtcTimeToLocal(row.endTime, taskDate)
      : row.end_time
      ? convertUtcTimeToLocal(row.end_time, taskDate)
      : null,
    deadline: row.deadline || null,
    priority: row.priority || "NORMAL",
    recurrence: row.recurrence || "ONCE",
    recurrenceConfig: row.recurrenceConfig || row.recurrence_config || null,
    dateOverrides,
    trackingType: row.trackingType || row.tracking_type || "BOOLEAN",
    targetValue: row.targetValue !== undefined && row.targetValue !== null
      ? parseFloat(row.targetValue)
      : (row.target_value !== null && row.target_value !== undefined ? parseFloat(row.target_value) : null),
    unit: row.unit || null,
    enableReminders:
      row.enableReminders !== undefined && row.enableReminders !== null
        ? Boolean(row.enableReminders)
        : row.enable_reminders !== undefined && row.enable_reminders !== null
        ? Boolean(row.enable_reminders)
        : rawOverrides._enableReminders !== undefined
        ? Boolean(rawOverrides._enableReminders)
        : false,
    reminderOffsetMinutes:
      row.reminderOffsetMinutes !== undefined && row.reminderOffsetMinutes !== null
        ? row.reminderOffsetMinutes
        : row.reminder_offset_minutes !== undefined && row.reminder_offset_minutes !== null
        ? row.reminder_offset_minutes
        : (rawOverrides._reminderOffsetMinutes ?? 10),
    reminderTimes: row.reminderTimes || row.reminder_times || rawOverrides._reminderTimes || ["11:00", "18:00"],
    isActive: row.isActive !== undefined ? Boolean(row.isActive) : Boolean(row.is_active),
    startedAt: row.startedAt || row.started_at || null,
    isArchived: row.isArchived !== undefined ? Boolean(row.isArchived) : Boolean(row.is_archived),
    sortOrder: row.sortOrder !== undefined ? row.sortOrder : (row.sort_order !== undefined && row.sort_order !== null ? row.sort_order : null),
    projectId: row.projectId !== undefined ? (row.projectId || null) : (row.project_id !== undefined ? (row.project_id || null) : null),
    // Kept even without a project: the "no project" board uses plain TODO/DONE statuses.
    projectStatus: row.projectStatus || row.project_status || null,
    projectCategory: (row.projectId || row.project_id)
      ? (row.projectCategory !== undefined
          ? (row.projectCategory || null)
          : row.project_category !== undefined
          ? (row.project_category || null)
          : (rawOverrides._projectCategory || null))
      : null,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
  };
}

/**
 * Inverse of the read mapping above: per-date overrides are kept in device-local "HH:mm" in the
 * app, but stored in UTC in the database (keyed by the local date). Metadata ("_key") is untouched.
 */
export function serializeDateOverridesForDb(
  overrides: Record<string, any> | null | undefined,
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(overrides || {})) {
    if (k.startsWith("_") || !v || typeof v !== "object") {
      result[k] = v;
      continue;
    }
    const entry: Record<string, any> = { ...v };
    if ("startTime" in entry) entry.startTime = entry.startTime ? convertLocalTimeToUtc(entry.startTime, k) : null;
    if ("endTime" in entry) entry.endTime = entry.endTime ? convertLocalTimeToUtc(entry.endTime, k) : null;
    result[k] = entry;
  }
  return result;
}

// Convert Supabase task row to camelCase Task with asynchronous decryption of sensitive fields
export async function mapDbTaskToModelAsync(row: any): Promise<Task> {
  const task = mapDbTaskToModel(row);
  return decryptTaskModel(task);
}

// Transparently decrypts title, description, and notes of a Task model
export async function decryptTaskModel(task: Task): Promise<Task> {
  let title = task.title;
  let description = task.description;

  if (title && isEncrypted(title)) {
    title = await decryptText(title);
  }
  if (description && isEncrypted(description)) {
    description = await decryptText(description);
  }

  return {
    ...task,
    title,
    description,
  };
}

export function mapDbCompletionToModel(row: any): TaskCompletion {
  return {
    id: row.id,
    taskId: row.taskId || row.task_id,
    userId: row.userId || row.user_id,
    date: row.date,
    completed: Boolean(row.completed),
    value: row.value !== null && row.value !== undefined ? parseFloat(row.value) : null,
    duration: row.duration || null,
    notes: row.notes || null,
    scheduledStartTime: row.scheduledStartTime
      ? convertUtcTimeToLocal(row.scheduledStartTime, row.date)
      : row.scheduled_start_time
      ? convertUtcTimeToLocal(row.scheduled_start_time, row.date)
      : null,
    scheduledEndTime: row.scheduledEndTime
      ? convertUtcTimeToLocal(row.scheduledEndTime, row.date)
      : row.scheduled_end_time
      ? convertUtcTimeToLocal(row.scheduled_end_time, row.date)
      : null,
    actualStartTime: row.actualStartTime
      ? convertUtcTimeToLocal(row.actualStartTime, row.date)
      : row.actual_start_time
      ? convertUtcTimeToLocal(row.actual_start_time, row.date)
      : null,
    actualEndTime: row.actualEndTime
      ? convertUtcTimeToLocal(row.actualEndTime, row.date)
      : row.actual_end_time
      ? convertUtcTimeToLocal(row.actual_end_time, row.date)
      : null,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
  };
}
