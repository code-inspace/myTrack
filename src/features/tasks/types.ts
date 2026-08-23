export type TrackingType = "BOOLEAN" | "NUMBER" | "DURATION" | "QUANTITY";

export type RecurrenceType = "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM";

export interface RecurrenceConfig {
  days?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface TaskDateOverride {
  startTime?: string | null;
  endTime?: string | null;
  isAllDay?: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  category: string;
  startTime?: string | null; // "07:00"
  endTime?: string | null;   // "08:00"
  recurrence: RecurrenceType;
  recurrenceConfig?: RecurrenceConfig | null;
  dateOverrides?: Record<string, TaskDateOverride> | null;
  trackingType: TrackingType;
  targetValue?: number | null;
  unit?: string | null;
  isActive: boolean;
  startedAt?: string | null;
  enableReminders?: boolean;
  reminderOffsetMinutes?: number | null;
  reminderTimes?: string[] | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  value?: number | null;
  duration?: number | null;
  notes?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithCompletion extends Task {
  completion?: TaskCompletion;
  isCompletedToday: boolean;
  currentValue?: number;
  effectiveStartTime?: string | null;
  effectiveEndTime?: string | null;
}

export * from "./schema";
