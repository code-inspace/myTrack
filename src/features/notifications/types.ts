export interface CustomReminder {
  id: string;
  userId: string;
  taskId?: string | null;
  taskTitle?: string;
  question: string; // e.g. "Have you done your push-ups today?"
  time: string;     // e.g. "18:00"
  days: number[];   // [1, 2, 3, 4, 5]
  enabled: boolean;
}

export interface NotificationPreference {
  pushEnabled: boolean;
  morningReminder: boolean;
  morningReminderTime: string;
  eveningRecap: boolean;
  eveningRecapTime: string;
  streakReminder: boolean;
  missedTaskReminder: boolean;
  oneSignalPlayerId?: string | null;
}

export interface InteractiveNotificationPayload {
  reminderId: string;
  taskId?: string | null;
  taskTitle: string;
  question: string;
  actionType: "YES_NO" | "QUANTITY";
  targetValue?: number;
  unit?: string;
}
