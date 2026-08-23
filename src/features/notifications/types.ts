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

  // Master Mute (Désactiver toutes les notifs avec restauration de l'état précédent)
  allDisabled?: boolean;
  previousPreferencesBackup?: Partial<NotificationPreference> | null;

  // Check-in périodique d'action actuelle (ex: toutes les 30 min de 09:00 à 22:00)
  currentActionCheckinEnabled?: boolean;
  currentActionIntervalMinutes?: number; // 15, 30, 45, 60, 120
  currentActionStartTime?: string;      // "09:00"
  currentActionEndTime?: string;        // "22:00"
  currentActionDays?: number[];         // [0, 1, 2, 3, 4, 5, 6]
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
