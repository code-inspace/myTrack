import { CalendarSubscription } from "../types";

export const CALENDAR_STORAGE_PREFIX = "mytrack_calendars_";

export function getStoredCalendarSubscriptions(userId: string): CalendarSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_PREFIX + userId);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to read stored calendars:", err);
    return [];
  }
}

export function saveStoredCalendarSubscriptions(
  subscriptions: CalendarSubscription[],
  userId: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CALENDAR_STORAGE_PREFIX + userId,
      JSON.stringify(subscriptions)
    );
  } catch (err) {
    console.warn("Failed to save stored calendars:", err);
  }
}
