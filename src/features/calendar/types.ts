export interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
  username?: string | null;
  password?: string | null;
  lastSyncedAt?: string;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalCalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  title: string;
  description?: string | null;
  location?: string | null;
  date: string; // "YYYY-MM-DD"
  startTime?: string | null; // "HH:mm" (null for all-day events)
  endTime?: string | null; // "HH:mm" (null for all-day events)
  isAllDay: boolean;
  startIso: string;
  endIso: string;
  projectId?: string | null;
  projectCategory?: string | null;
}

export const DEFAULT_CALENDAR_COLORS = [
  "#3B82F6", // Blue (Google)
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#D4F63D", // Lime / Accent
];
