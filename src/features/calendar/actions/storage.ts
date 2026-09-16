import { CalendarSubscription } from "../types";

export const CALENDAR_STORAGE_PREFIX = "mytrack_calendars_";

function getSafeStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return null;
}

export function getStoredCalendarSubscriptions(userId?: string): CalendarSubscription[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    // 1. Direct user key
    if (userId) {
      const raw = storage.getItem(CALENDAR_STORAGE_PREFIX + userId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }

    // 2. Generic key fallback
    const genericRaw = storage.getItem("mytrack_calendars");
    if (genericRaw) {
      const parsed = JSON.parse(genericRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // 3. Scan any other calendar storage keys if available
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(CALENDAR_STORAGE_PREFIX)) {
        const raw = storage.getItem(key);
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
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const json = JSON.stringify(subscriptions);
    if (userId) {
      storage.setItem(CALENDAR_STORAGE_PREFIX + userId, json);
    }
    storage.setItem("mytrack_calendars", json);
  } catch (err) {
    console.warn("Failed to save stored calendars:", err);
  }
}

export const EXTERNAL_EVENTS_STORAGE_PREFIX = "mytrack_external_events_";

export function getStoredExternalEvents(userId?: string): import("../types").ExternalCalendarEvent[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const key = userId ? EXTERNAL_EVENTS_STORAGE_PREFIX + userId : "mytrack_external_events";
    const raw = storage.getItem(key) || storage.getItem("mytrack_external_events");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredExternalEvents(
  events: import("../types").ExternalCalendarEvent[],
  userId?: string
): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const json = JSON.stringify(events);
    if (userId) {
      storage.setItem(EXTERNAL_EVENTS_STORAGE_PREFIX + userId, json);
    }
    storage.setItem("mytrack_external_events", json);
  } catch {}
}

export const EVENT_PROJECT_STORAGE_PREFIX = "mytrack_event_projects_";

export interface EventProjectMapping {
  projectId?: string | null;
  projectCategory?: string | null;
}

// In-memory fallback if localStorage is completely absent (SSR / test mocks)
let memoryEventProjects: Record<string, Record<string, EventProjectMapping>> = {};

export function getStoredEventProjects(userId?: string): Record<string, EventProjectMapping> {
  const storage = getSafeStorage();
  if (!storage) {
    const memKey = userId || "default";
    return memoryEventProjects[memKey] || {};
  }
  try {
    const key = userId ? EVENT_PROJECT_STORAGE_PREFIX + userId : "mytrack_event_projects";
    const raw = storage.getItem(key) || storage.getItem("mytrack_event_projects");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
    return {};
  } catch {
    return {};
  }
}

export function saveStoredEventProject(
  eventId: string,
  mapping: EventProjectMapping,
  userId?: string
): void {
  const storage = getSafeStorage();
  if (!storage) {
    const memKey = userId || "default";
    if (!memoryEventProjects[memKey]) {
      memoryEventProjects[memKey] = {};
    }
    if (!mapping.projectId) {
      delete memoryEventProjects[memKey][eventId];
    } else {
      memoryEventProjects[memKey][eventId] = mapping;
    }
    return;
  }
  try {
    const current = getStoredEventProjects(userId);
    if (!mapping.projectId) {
      delete current[eventId];
    } else {
      current[eventId] = mapping;
    }
    const json = JSON.stringify(current);
    if (userId) {
      storage.setItem(EVENT_PROJECT_STORAGE_PREFIX + userId, json);
    }
    storage.setItem("mytrack_event_projects", json);
  } catch (err) {
    console.warn("Failed to save event project mapping:", err);
  }
}


