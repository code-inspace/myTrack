import { CustomReminder, NotificationPreference, InteractiveNotificationPayload } from "./types";
import { getStoredTasks, getStoredCompletions, saveStoredCompletions } from "../tasks/actions";
import { getTodayDateString } from "@/lib/dates";

const REMINDERS_KEY = "mytrack_custom_reminders_v1";
const PREFERENCES_KEY = "mytrack_notification_preferences_v1";

export const DEFAULT_REMINDERS: CustomReminder[] = [
  {
    id: "rem-1",
    userId: "user-demo",
    taskId: "task-seed-2",
    taskTitle: "Push-ups",
    question: "Have you done your push-ups today?",
    time: "18:00",
    days: [1, 2, 3, 4, 5],
    enabled: true,
  },
  {
    id: "rem-2",
    userId: "user-demo",
    taskId: "task-seed-3",
    taskTitle: "Read book",
    question: "Did you read your 20 pages today?",
    time: "21:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
  },
];

export const DEFAULT_PREFERENCES: NotificationPreference = {
  pushEnabled: true,
  morningReminder: true,
  morningReminderTime: "08:00",
  eveningRecap: true,
  eveningRecapTime: "21:00",
  streakReminder: true,
  missedTaskReminder: true,
};

export function getStoredReminders(): CustomReminder[] {
  if (typeof window === "undefined") return DEFAULT_REMINDERS;
  const stored = localStorage.getItem(REMINDERS_KEY);
  if (!stored) {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(DEFAULT_REMINDERS));
    return DEFAULT_REMINDERS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function saveStoredReminders(reminders: CustomReminder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

export function getStoredPreferences(): NotificationPreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  const stored = localStorage.getItem(PREFERENCES_KEY);
  if (!stored) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    return DEFAULT_PREFERENCES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveStoredPreferences(prefs: NotificationPreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

/**
 * Handle interactive notification action
 * When user clicks YES / NO / logs quantity
 */
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
        userId: "user-demo",
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
