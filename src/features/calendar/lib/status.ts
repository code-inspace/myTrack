import { ExternalCalendarEvent } from "../types";
import { getTodayDateString } from "@/lib/dates";
import { parseISO, format, subDays, addDays } from "date-fns";

export type ExternalEventStatus = "DONE" | "IN_PROGRESS" | "TODO";

/**
 * Calculates real-time status for an external calendar event based on its date & time:
 * - "DONE": Event is finished (event.date < today, or ended earlier today, or manually marked completed)
 * - "IN_PROGRESS": Event is happening right now today (current time is between start & end on today)
 * - "TODO": Event is upcoming (scheduled for later today, or a future date)
 */
export function getExternalEventStatus(
  event: ExternalCalendarEvent,
  targetDateStr: string = getTodayDateString(),
  manualCompleted?: boolean
): ExternalEventStatus {
  if (manualCompleted !== undefined) {
    return manualCompleted ? "DONE" : "TODO";
  }

  const todayStr = getTodayDateString();
  const eventDate = event.date || targetDateStr;

  // 1. Past date -> Finished
  if (eventDate < todayStr) {
    return "DONE";
  }

  // 2. Future date -> Upcoming
  if (eventDate > todayStr) {
    return "TODO";
  }

  // 3. Event is TODAY -> Check live clock
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (event.isAllDay) {
    return "IN_PROGRESS";
  }

  if (!event.startTime) {
    return "TODO";
  }

  const [sH, sM] = event.startTime.split(":").map(Number);
  const startMinutes = (sH || 0) * 60 + (sM || 0);

  let endMinutes = startMinutes + 60; // default 1 hour duration
  if (event.endTime) {
    const [eH, eM] = event.endTime.split(":").map(Number);
    endMinutes = (eH || 0) * 60 + (eM || 0);
  }

  if (nowMinutes >= endMinutes) {
    return "DONE";
  }

  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
    return "IN_PROGRESS";
  }

  return "TODO";
}

export function isExternalEventDone(
  event: ExternalCalendarEvent,
  targetDateStr: string = getTodayDateString(),
  manualCompleted?: boolean
): boolean {
  return getExternalEventStatus(event, targetDateStr, manualCompleted) === "DONE";
}

export function isExternalEventInProgress(
  event: ExternalCalendarEvent,
  targetDateStr: string = getTodayDateString(),
  manualCompleted?: boolean
): boolean {
  return getExternalEventStatus(event, targetDateStr, manualCompleted) === "IN_PROGRESS";
}

/**
 * Checks if a finished external event falls within the selected Done period:
 * - "1d": Exactly today
 * - "7d": Between 6 days ago and today
 * - "30d": Between 29 days ago and today
 */
export function isEventInDonePeriod(
  eventDate: string,
  period: "1d" | "7d" | "30d",
  todayStr: string = getTodayDateString()
): boolean {
  try {
    const today = parseISO(todayStr);
    if (period === "1d") {
      return eventDate === todayStr;
    }
    if (period === "7d") {
      const cutoff7d = format(subDays(today, 6), "yyyy-MM-dd");
      return eventDate >= cutoff7d && eventDate <= todayStr;
    }
    if (period === "30d") {
      const cutoff30d = format(subDays(today, 29), "yyyy-MM-dd");
      return eventDate >= cutoff30d && eventDate <= todayStr;
    }
  } catch {
    return eventDate === todayStr;
  }
  return true;
}

/**
 * Checks if an upcoming external event is within the rolling next 7 days window:
 * `today <= event.date <= today + 7 days`
 */
export function isEventInRollingWeek(
  eventDate: string,
  todayStr: string = getTodayDateString()
): boolean {
  try {
    const today = parseISO(todayStr);
    const maxDate = format(addDays(today, 7), "yyyy-MM-dd");
    return eventDate >= todayStr && eventDate <= maxDate;
  } catch {
    return eventDate === todayStr;
  }
}
