import { Task, TaskCompletion, TaskFormValues } from "./types";
import { getStoredUserSession, DEMO_USER } from "@/features/auth/actions";
import { createClient } from "@/utils/supabase/client";
import { getTodayDateString, convertLocalTimeToUtc, convertUtcTimeToLocal, createUtcIsoFromLocalDateTime } from "@/lib/dates";
import { scheduleTaskPushNotification } from "@/lib/onesignal/client";

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
    _enableReminders: task.enableReminders !== undefined ? task.enableReminders : true,
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
    recurrence: task.recurrence,
    recurrence_config: task.recurrenceConfig || null,
    date_overrides: taskOverrides,
    tracking_type: task.trackingType,
    target_value: task.targetValue !== undefined ? task.targetValue : null,
    unit: task.unit || null,
    is_active: false,
    started_at: null,
    is_archived: false,
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