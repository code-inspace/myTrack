import { CustomReminder, NotificationPreference, InteractiveNotificationPayload } from "./types";
import { getStoredTasks, getStoredCompletions, saveStoredCompletions, getEffectiveUserId } from "../tasks/actions";
import { getTodayDateString } from "@/lib/dates";
import { createClient } from "@/utils/supabase/client";

const REMINDERS_KEY = "mytrack_custom_reminders_v1";
const PREFERENCES_KEY = "mytrack_notification_preferences_v1";

export const DEFAULT_REMINDERS: CustomReminder[] = [];

export const DEFAULT_PREFERENCES: NotificationPreference = {
  pushEnabled: true,
  morningReminder: true,
  morningReminderTime: "08:00",
  eveningRecap: true,
  eveningRecapTime: "21:00",
  streakReminder: true,
  missedTaskReminder: true,
};

export async function fetchReminders(userId?: string): Promise<CustomReminder[]> {
  const targetId = getEffectiveUserId(userId);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notification_schedules")
      .select("*, tasks(title)")
      .eq("user_id", targetId);

    if (!error && data) {
      const mapped: CustomReminder[] = data.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        taskId: r.task_id,
        taskTitle: r.tasks?.title || "Habitude",
        question: r.question,
        time: r.time,
        days: r.days,
        enabled: r.enabled,
      }));
      saveStoredReminders(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchReminders fallback:", err);
  }
  return getStoredReminders();
}

export function getStoredReminders(): CustomReminder[] {
  if (typeof window === "undefined") return DEFAULT_REMINDERS;
  const stored = localStorage.getItem(REMINDERS_KEY);
  if (!stored) return DEFAULT_REMINDERS;
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function saveDbReminder(reminder: Omit<CustomReminder, "id"> & { id?: string }): Promise<void> {
  const targetId = reminder.userId || getEffectiveUserId();

  try {
    const supabase = createClient();
    await supabase.from("notification_schedules").insert([
      {
        user_id: targetId,
        task_id: reminder.taskId || null,
        question: reminder.question,
        time: reminder.time,
        days: reminder.days,
        enabled: reminder.enabled,
      },
    ]);
  } catch (err) {
    console.warn("Supabase saveDbReminder fallback:", err);
  }

  const current = getStoredReminders();
  const newRecord: CustomReminder = {
    ...reminder,
    id: reminder.id || "rem-" + Date.now(),
    userId: targetId,
  };
  saveStoredReminders([...current, newRecord]);
}

export async function deleteDbReminder(reminderId: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from("notification_schedules").delete().eq("id", reminderId);
  } catch (err) {
    console.warn("Supabase deleteDbReminder fallback:", err);
  }

  const current = getStoredReminders();
  saveStoredReminders(current.filter((r) => r.id !== reminderId));
}

export function saveStoredReminders(reminders: CustomReminder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

export async function fetchPreferences(userId?: string): Promise<NotificationPreference> {
  const targetId = getEffectiveUserId(userId);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", targetId)
      .single();

    if (!error && data) {
      const mapped: NotificationPreference = {
        pushEnabled: data.push_enabled,
        morningReminder: data.morning_reminder,
        morningReminderTime: data.morning_reminder_time,
        eveningRecap: data.evening_recap,
        eveningRecapTime: data.evening_recap_time,
        streakReminder: data.streak_reminder,
        missedTaskReminder: data.missed_task_reminder,
        oneSignalPlayerId: data.onesignal_player_id,
      };
      saveStoredPreferences(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchPreferences fallback:", err);
  }
  return getStoredPreferences();
}

export function getStoredPreferences(): NotificationPreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  const stored = localStorage.getItem(PREFERENCES_KEY);
  if (!stored) return DEFAULT_PREFERENCES;
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function updateDbPreferences(prefs: NotificationPreference, userId?: string): Promise<void> {
  const targetId = getEffectiveUserId(userId);
  try {
    const supabase = createClient();
    await supabase.from("notification_preferences").upsert(
      [
        {
          user_id: targetId,
          push_enabled: prefs.pushEnabled,
          morning_reminder: prefs.morningReminder,
          morning_reminder_time: prefs.morningReminderTime,
          evening_recap: prefs.eveningRecap,
          evening_recap_time: prefs.eveningRecapTime,
          streak_reminder: prefs.streakReminder,
          missed_task_reminder: prefs.missedTaskReminder,
          onesignal_player_id: prefs.oneSignalPlayerId,
        },
      ],
      { onConflict: "user_id" }
    );
  } catch (err) {
    console.warn("Supabase updateDbPreferences fallback:", err);
  }
  saveStoredPreferences(prefs);
}

export function saveStoredPreferences(prefs: NotificationPreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

export function handleInteractiveNotificationResponse(
  taskId: string,
  response: { action: "YES" | "NO" | "QUANTITY"; value?: number }
): { success: boolean; message: string } {
  const date = getTodayDateString();
  const completions = getStoredCompletions();
  const index = completions.findIndex((c) => c.taskId === taskId && c.date === date);

  const completed = response.action === "YES" || response.action === "QUANTITY";
  const val = response.action === "QUANTITY" ? response.value : undefined;

  let updated = [...completions];
  if (index >= 0) {
    updated[index] = {
      ...updated[index],
      completed,
      value: val !== undefined ? val : updated[index].value,
      updatedAt: new Date().toISOString(),
    };
  } else {
    updated = [
      {
        id: "comp-" + Date.now(),
        taskId,
        userId: getEffectiveUserId(),
        date,
        completed,
        value: val || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...completions,
    ];
  }

  saveStoredCompletions(updated);
  return {
    success: true,
    message: completed
      ? "Super ! Ton accomplissement a été enregistré."
      : "Pas de souci, tu feras mieux demain !",
  };
}
