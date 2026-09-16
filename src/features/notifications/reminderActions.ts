import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from "@/features/tasks/actions";

export interface StoredReminderRecord {
  id: string;
  userId: string;
  taskId?: string | null;
  title: string;
  body: string;
  scheduledAt: string; // ISO string
  status: "pending" | "scheduled" | "sent" | "failed" | "cancelled";
  onesignalNotificationId?: string | null;
  errorMessage?: string | null;
  reminderType: "task_reminder" | "bedtime" | "checkin" | "custom" | "morning" | "evening";
  createdAt: string;
  updatedAt: string;
}

const REMINDERS_LOCAL_STORAGE_KEY = "mytrack_reminders_";

export async function createDbReminder(
  params: Omit<StoredReminderRecord, "id" | "createdAt" | "updatedAt" | "status"> & {
    id?: string;
    status?: "pending" | "scheduled" | "sent" | "failed" | "cancelled";
  }
): Promise<StoredReminderRecord> {
  const supabase = createClient();
  const targetUserId = params.userId || getEffectiveUserId();
  const nowIso = new Date().toISOString();
  const reminderId = params.id || `rem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  const record: StoredReminderRecord = {
    id: reminderId,
    userId: targetUserId,
    taskId: params.taskId || null,
    title: params.title,
    body: params.body,
    scheduledAt: params.scheduledAt,
    status: params.status || "pending",
    onesignalNotificationId: params.onesignalNotificationId || null,
    errorMessage: params.errorMessage || null,
    reminderType: params.reminderType || "task_reminder",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. Try Supabase insert if not demo
  if (targetUserId) {
    const isUuid = Boolean(
      record.taskId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          record.taskId
        )
    );
    try {
      const { data, error } = await supabase
        .from("reminders")
        .insert([
          {
            user_id: targetUserId,
            task_id: isUuid ? record.taskId : null,
            title: record.title,
            body: record.body,
            scheduled_at: record.scheduledAt,
            status: record.status,
            onesignal_notification_id: record.onesignalNotificationId,
            error_message: record.errorMessage,
            reminder_type: record.reminderType,
            created_at: record.createdAt,
            updated_at: record.updatedAt,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        record.id = data.id;
      } else if (error) {
        console.warn("[Reminders] Supabase insert note:", error.message);
      }
    } catch (err) {
      console.warn("[Reminders] Supabase insert error:", err);
    }
  }

  // 2. Save in localStorage cache
  if (typeof window !== "undefined") {
    try {
      const key = `${REMINDERS_LOCAL_STORAGE_KEY}${targetUserId}`;
      const stored = localStorage.getItem(key);
      const list: StoredReminderRecord[] = stored ? JSON.parse(stored) : [];
      const updated = [record, ...list.filter((r) => r.id !== record.id)];
      localStorage.setItem(key, JSON.stringify(updated.slice(0, 50)));
    } catch {}
  }

  return record;
}

export async function updateDbReminderStatus(
  reminderId: string,
  updates: {
    status: "pending" | "scheduled" | "sent" | "failed" | "cancelled";
    onesignalNotificationId?: string | null;
    errorMessage?: string | null;
    userId?: string;
  }
): Promise<void> {
  const supabase = createClient();
  const targetUserId = updates.userId || getEffectiveUserId();
  const nowIso = new Date().toISOString();

  // 1. Update in Supabase
  if (targetUserId) {
    try {
      await supabase
        .from("reminders")
        .update({
          status: updates.status,
          onesignal_notification_id: updates.onesignalNotificationId || null,
          error_message: updates.errorMessage || null,
          updated_at: nowIso,
        })
        .eq("id", reminderId);
    } catch (err) {
      console.warn("[Reminders] Supabase update status error:", err);
    }
  }

  // 2. Update localStorage cache
  if (typeof window !== "undefined") {
    try {
      const key = `${REMINDERS_LOCAL_STORAGE_KEY}${targetUserId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: StoredReminderRecord[] = JSON.parse(stored);
        const updated = list.map((r) =>
          r.id === reminderId
            ? {
                ...r,
                status: updates.status,
                onesignalNotificationId: updates.onesignalNotificationId ?? r.onesignalNotificationId,
                errorMessage: updates.errorMessage ?? r.errorMessage,
                updatedAt: nowIso,
              }
            : r
        );
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {}
  }
}

export async function fetchUserReminders(userId?: string): Promise<StoredReminderRecord[]> {
  const supabase = createClient();
  const targetUserId = userId || getEffectiveUserId();

  if (targetUserId) {
    try {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", targetUserId)
        .order("scheduled_at", { ascending: false })
        .limit(25);

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          taskId: row.task_id,
          title: row.title,
          body: row.body,
          scheduledAt: row.scheduled_at,
          status: row.status,
          onesignalNotificationId: row.onesignal_notification_id,
          errorMessage: row.error_message,
          reminderType: row.reminder_type,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
    } catch (err) {
      console.warn("[Reminders] Supabase fetch error:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const key = `${REMINDERS_LOCAL_STORAGE_KEY}${targetUserId}`;
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {}
  }

  return [];
}
