import { Task, TaskCompletion } from "../types";
import { isEncrypted, decryptText } from "@/lib/crypto/encryption";

export const TASKS_STORAGE_PREFIX = "mytrack_tasks_";
export const COMPLETIONS_STORAGE_PREFIX = "mytrack_completions_";

// Convert Supabase snake_case task row to camelCase Task with local timezone conversion
export function mapDbTaskToModel(row: any): Task {
  const rawOverrides = row.date_overrides || {};
  const dateOverrides: Record<string, any> = {};

  for (const [k, v] of Object.entries(rawOverrides)) {
    if (k.startsWith("_")) {
      dateOverrides[k] = v;
    } else if (v && typeof v === "object") {
      dateOverrides[k] = {
        ...(v as any),
        startTime: (v as any).startTime || null,
        endTime: (v as any).endTime || null,
      };
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || null,
    tag: row.tag || row.category || rawOverrides._tag || "General",
    category: row.tag || row.category || rawOverrides._tag || "General",
    startTime: row.start_time || null,
    endTime: row.end_time || null,
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
    projectCategory: row.project_category || rawOverrides._projectCategory || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
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
