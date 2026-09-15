import { TaskWithCompletion } from "./types";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { isExternalEventDone, isExternalEventInProgress } from "@/features/calendar/lib/status";

export type UnifiedStreamItem =
  | { type: "task"; id: string; data: TaskWithCompletion }
  | { type: "event"; id: string; data: ExternalCalendarEvent };

/**
 * Builds and sorts the unified stream of tasks and external events for the List page.
 * Sorting rules:
 * 1. Non-validated items (upcoming/active tasks & events) come BEFORE completed / passed items.
 * 2. In-progress items come first.
 * 3. Drag-and-drop sort order (when set).
 * 4. Chronological start time (timed items first).
 * 5. Title alphabetical fallback.
 */
export function buildAndSortUnifiedStream(
  tasks: TaskWithCompletion[],
  events: ExternalCalendarEvent[],
  selectedDate: string,
  manualCompletedEvents: Record<string, boolean> = {},
  showCalendar = true
): UnifiedStreamItem[] {
  const taskItems: UnifiedStreamItem[] = tasks
    .filter((t) => !t.isActive)
    .map((t) => ({
      type: "task",
      id: t.id,
      data: t,
    }));

  const eventItems: UnifiedStreamItem[] = (showCalendar ? events : [])
    .filter((e) => e.date === selectedDate)
    .map((e) => ({
      type: "event",
      id: e.id.startsWith("event_") ? e.id : `event_${e.id}`,
      data: e,
    }));

  const combined = [...taskItems, ...eventItems];

  return combined.sort((a, b) => {
    // 1. Completion / Passed Status: Non-validated before finished/passed
    const aDone =
      a.type === "task"
        ? a.data.isCompletedToday
        : isExternalEventDone(a.data, selectedDate, manualCompletedEvents[a.data.id]);

    const bDone =
      b.type === "task"
        ? b.data.isCompletedToday
        : isExternalEventDone(b.data, selectedDate, manualCompletedEvents[b.data.id]);

    if (!aDone && bDone) return -1;
    if (aDone && !bDone) return 1;

    // 2. In-Progress items (LIVE event or active task)
    const aInProgress =
      a.type === "event"
        ? isExternalEventInProgress(a.data, selectedDate, manualCompletedEvents[a.data.id])
        : false;
    const bInProgress =
      b.type === "event"
        ? isExternalEventInProgress(b.data, selectedDate, manualCompletedEvents[b.data.id])
        : false;

    if (aInProgress && !bInProgress) return -1;
    if (!aInProgress && bInProgress) return 1;

    // 3. Explicit sortOrder (on tasks)
    const aOrder = a.type === "task" ? a.data.sortOrder : undefined;
    const bOrder = b.type === "task" ? b.data.sortOrder : undefined;
    if (aOrder != null && bOrder != null) return aOrder - bOrder;

    // 4. Start Time (Chronological)
    const aTime =
      a.type === "task"
        ? a.data.effectiveStartTime || a.data.startTime
        : a.data.startTime;
    const bTime =
      b.type === "task"
        ? b.data.effectiveStartTime || b.data.startTime
        : b.data.startTime;

    if (aTime && bTime) return aTime.localeCompare(bTime);
    if (aTime && !bTime) return -1;
    if (!aTime && bTime) return 1;

    // 5. Title
    const aTitle = a.data.title || "";
    const bTitle = b.data.title || "";
    return aTitle.localeCompare(bTitle);
  });
}
