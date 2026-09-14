import { CalendarSubscription } from "../types";

export const CALENDAR_STORAGE_PREFIX = "mytrack_calendars_";

export function getStoredCalendarSubscriptions(userId?: string): CalendarSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    // 1. Direct user key
    if (userId) {
      const raw = localStorage.getItem(CALENDAR_STORAGE_PREFIX + userId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }

    // 2. Generic key fallback
    const genericRaw = localStorage.getItem("mytrack_calendars");
    if (genericRaw) {
      const parsed = JSON.parse(genericRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // 3. Scan any other calendar storage keys if available
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CALENDAR_STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    }

    return [];
  } catch (err) {
    console.warn("Failed to read stored calendars:", err);
    return [];
  }
}

export function saveStoredCalendarSubscriptions(
  subscriptions: CalendarSubscription[],
  userId?: string
): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(subscriptions);
    if (userId) {
      localStorage.setItem(CALENDAR_STORAGE_PREFIX + userId, json);
    }
    localStorage.setItem("mytrack_calendars", json);
  } catch (err) {
    console.warn("Failed to save stored calendars:", err);
  }
}
