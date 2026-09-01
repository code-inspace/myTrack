import { ExternalCalendarEvent } from "../types";
import { getTodayDateString } from "@/lib/dates";

export type ExternalEventStatus = "DONE" | "IN_PROGRESS" | "TODO";

/**
 * Calculates real-time status for an external calendar event on a target date:
 * - "DONE": Event is finished (past date, or past end time on today, or manually marked completed)
 * - "IN_PROGRESS": Current time is within the event's duration (today)
 * - "TODO": Event is scheduled for the future
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

  // 1. Past date -> Finished
  if (targetDateStr < todayStr) {
    return "DONE";
  }

  // 2. Future date -> Upcoming
  if (targetDateStr > todayStr) {
    return "TODO";
  }

  // 3. Today -> Check live clock
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
