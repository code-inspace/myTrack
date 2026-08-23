export type TrackingType = "BOOLEAN" | "NUMBER" | "DURATION" | "QUANTITY";

export type RecurrenceType = "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM";

export interface RecurrenceConfig {
  days?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
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
  trackingType: TrackingType;
  targetValue?: number | null;
  unit?: string | null;
  isActive: boolean;
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
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithCompletion extends Task {
  completion?: TaskCompletion;
  isCompletedToday: boolean;
  currentValue?: number;
}

export * from "./schema";
