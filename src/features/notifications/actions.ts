import { CustomReminder, NotificationPreference } from "./types";
import { getStoredCompletions, saveStoredCompletions, getEffectiveUserId } from "../tasks/actions";
import { getTodayDateString, convertLocalTimeToUtc, convertUtcTimeToLocal } from "@/lib/dates";
import { createClient } from "@/utils/supabase/client";

const REMINDERS_KEY = "mytrack_custom_reminders_v1";
const PREFERENCES_KEY = "mytrack_notification_preferences_v1";

export const DEFAULT_REMINDERS: CustomReminder[] = [];

export const DEFAULT_PREFERENCES: NotificationPreference = {
  pushEnabled: true,
  allDisabled: false,
  previousPreferencesBackup: null,
  morningReminder: true,
  morningReminderTime: "08:00",
  eveningRecap: true,
  eveningRecapTime: "21:00",
  streakReminder: true,
  missedTaskReminder: true,
  currentActionCheckinEnabled: false,
  currentActionIntervalMinutes: 30,
  currentActionStartTime: "09:00",
  currentActionEndTime: "22:00",
  currentActionDays: [1, 2, 3, 4, 5],
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
        time: convertUtcTimeToLocal(r.time),
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

import { scheduleTaskPushNotification } from "@/lib/onesignal/client";

export async function saveDbReminder(reminder: Omit<CustomReminder, "id"> & { id?: string }): Promise<void> {
  const targetId = reminder.userId || getEffectiveUserId();
  const utcTime = reminder.time ? convertLocalTimeToUtc(reminder.time) : reminder.time;

  try {
    const supabase = createClient();
    await supabase.from("notification_schedules").insert([
      {
        user_id: targetId,
        task_id: reminder.taskId || null,
        question: reminder.question,
        time: utcTime,
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

  // Schedule OneSignal push for this custom reminder (uses local time for client scheduler)
  if (newRecord.enabled && newRecord.time) {
    scheduleTaskPushNotification({
      userId: targetId,
      taskId: newRecord.taskId || undefined,
      taskTitle: newRecord.question,
      startTime: newRecord.time,
      type: "custom_reminder",
    }).catch((e) => console.warn("OneSignal custom reminder push note:", e));
  }
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
      const stored = getStoredPreferences();
      const mapped: NotificationPreference = {
        pushEnabled: data.push_enabled ?? true,
        morningReminder: data.morning_reminder ?? true,
        morningReminderTime: data.morning_reminder_time ? convertUtcTimeToLocal(data.morning_reminder_time) : "08:00",
        eveningRecap: data.evening_recap ?? true,
        eveningRecapTime: data.evening_recap_time ? convertUtcTimeToLocal(data.evening_recap_time) : "21:00",
        streakReminder: data.streak_reminder ?? true,
        missedTaskReminder: data.missed_task_reminder ?? true,
        oneSignalPlayerId: data.onesignal_player_id,
        allDisabled: data.all_disabled !== undefined ? data.all_disabled : stored.allDisabled ?? false,
        previousPreferencesBackup: stored.previousPreferencesBackup || null,
        currentActionCheckinEnabled: data.current_action_checkin_enabled !== undefined ? data.current_action_checkin_enabled : stored.currentActionCheckinEnabled ?? false,
        currentActionIntervalMinutes: data.current_action_interval_minutes || stored.currentActionIntervalMinutes || 30,
        currentActionStartTime: data.current_action_start_time ? convertUtcTimeToLocal(data.current_action_start_time) : "09:00",
        currentActionEndTime: data.current_action_end_time ? convertUtcTimeToLocal(data.current_action_end_time) : "22:00",
        currentActionDays: data.current_action_days || stored.currentActionDays || [1, 2, 3, 4, 5],
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
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function updateDbPreferences(prefs: NotificationPreference, userId?: string): Promise<void> {
  const targetId = getEffectiveUserId(userId);
  const utcMorningTime = prefs.morningReminderTime ? convertLocalTimeToUtc(prefs.morningReminderTime) : "08:00";
  const utcEveningTime = prefs.eveningRecapTime ? convertLocalTimeToUtc(prefs.eveningRecapTime) : "21:00";
  const utcActionStartTime = prefs.currentActionStartTime ? convertLocalTimeToUtc(prefs.currentActionStartTime) : "09:00";
  const utcActionEndTime = prefs.currentActionEndTime ? convertLocalTimeToUtc(prefs.currentActionEndTime) : "22:00";

  try {
    const supabase = createClient();
    await supabase.from("notification_preferences").upsert(
      [
        {
          user_id: targetId,
          push_enabled: prefs.pushEnabled,
          morning_reminder: prefs.morningReminder,
          morning_reminder_time: utcMorningTime,
          evening_recap: prefs.eveningRecap,
          evening_recap_time: utcEveningTime,
          streak_reminder: prefs.streakReminder,
          missed_task_reminder: prefs.missedTaskReminder,
          onesignal_player_id: prefs.oneSignalPlayerId,
          current_action_checkin_enabled: prefs.currentActionCheckinEnabled,
          current_action_interval_minutes: prefs.currentActionIntervalMinutes,
          current_action_start_time: utcActionStartTime,
          current_action_end_time: utcActionEndTime,
          current_action_days: prefs.currentActionDays,
        },
      ],
      { onConflict: "user_id" }
    );
  } catch (err) {
    console.warn("Supabase updateDbPreferences fallback:", err);
  }
  saveStoredPreferences(prefs);

  // Schedule Morning & Evening routines via OneSignal
  if (prefs.pushEnabled && !prefs.allDisabled) {
    if (prefs.morningReminder && prefs.morningReminderTime) {
      scheduleTaskPushNotification({
        userId: targetId,
        taskId: `routine_morning_${targetId}`,
        taskTitle: "Objectifs du jour",
        startTime: prefs.morningReminderTime,
        type: "morning_routine",
        customMessage: "C'est l'heure",
        replaceExisting: true,
      }).catch(() => {});
    }

    if (prefs.eveningRecap && prefs.eveningRecapTime) {
      scheduleTaskPushNotification({
        userId: targetId,
        taskId: `routine_evening_${targetId}`,
        taskTitle: "Bilan de ta journée",
        startTime: prefs.eveningRecapTime,
        type: "evening_recap",
        customMessage: "C'est l'heure",
        replaceExisting: true,
      }).catch(() => {});
    }
  }
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
