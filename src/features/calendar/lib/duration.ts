import { ExternalCalendarEvent } from "../types";

/**
 * Returns duration of an external calendar event in minutes.
 * - If start/end times exist: difference in minutes
 * - If startIso/endIso exist: difference in minutes
 * - If all-day: 60 minutes default block
 * - Otherwise: 30 minutes fallback
 */
export function getExternalEventDurationMinutes(event: ExternalCalendarEvent): number {
  if (event.isAllDay) {
    return 60;
  }

  if (event.startTime && event.endTime) {
    const [h1, m1] = event.startTime.split(":").map(Number);
    const [h2, m2] = event.endTime.split(":").map(Number);
    const diff = (h2 || 0) * 60 + (m2 || 0) - ((h1 || 0) * 60 + (m1 || 0));
    if (diff > 0) return diff;
  }

  if (event.startIso && event.endIso) {
    try {
      const d1 = new Date(event.startIso).getTime();
      const d2 = new Date(event.endIso).getTime();
      const diff = Math.round((d2 - d1) / (1000 * 60));
      if (diff > 0) return diff;
    } catch {}
  }

  return 30;
}
