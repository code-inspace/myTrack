import type { Task, TaskCompletion } from "./types";

/** Default length of a task block when nothing else says how long it lasts (same as the task form). */
export const DEFAULT_TASK_DURATION_MINUTES = 60;

/**
 * The target duration in minutes of a task, if it has one. Only DURATION-tracked tasks have a
 * time target: the targetValue of a NUMBER/QUANTITY task (50 pompes, 2 litres) is not minutes.
 * `duration` on completions is always in minutes.
 */
export function getTargetDurationMinutes(
  task: Pick<Task, "trackingType" | "targetValue" | "unit"> | null | undefined,
): number | null {
  if (!task || task.trackingType !== "DURATION") return null;
  const value = Number(task.targetValue);
  if (!value || value <= 0) return null;
  const unit = (task.unit || "min").trim().toLowerCase();
  if (unit === "h" || unit.startsWith("heure") || unit.startsWith("hour")) return Math.round(value * 60);
  if (unit === "s" || unit.startsWith("sec")) return Math.max(1, Math.round(value / 60));
  return Math.round(value);
}

export function getDefaultTaskDurationMinutes(
  task: Pick<Task, "trackingType" | "targetValue" | "unit"> | null | undefined,
): number {
  return getTargetDurationMinutes(task) ?? DEFAULT_TASK_DURATION_MINUTES;
}

/** Minutes between two "HH:mm" times, wrapping past midnight. Null if either is missing/invalid. */
export function minutesBetween(startTime?: string | null, endTime?: string | null): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => isNaN(n))) return null;
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/**
 * Minutes actually spent on a completed occurrence: the measured `duration` (timer, possibly
 * accumulated over several sessions) wins; otherwise the actual time span.
 */
export function getCompletionMinutes(
  completion: Pick<TaskCompletion, "duration" | "actualStartTime" | "actualEndTime">,
): number | null {
  if (typeof completion.duration === "number" && completion.duration > 0) return completion.duration;
  const span = minutesBetween(completion.actualStartTime, completion.actualEndTime);
  return span && span > 0 ? span : null;
}

/**
 * How an existing completion follows when its occurrence is moved/resized on the agenda. The
 * agenda draws an occurrence at its actual times when it has some (mapTaskWithCompletion), so the
 * block is the record: recorded actual times move with it, and a completed occurrence's duration
 * becomes the block length. Unrecorded actual times stay empty.
 */
export function getCompletionFieldsAfterReschedule(
  existing: Pick<TaskCompletion, "completed" | "duration" | "actualStartTime" | "actualEndTime">,
  startTime: string | null,
  endTime: string | null,
): Pick<
  TaskCompletion,
  "scheduledStartTime" | "scheduledEndTime" | "actualStartTime" | "actualEndTime" | "duration"
> {
  const span = minutesBetween(startTime, endTime);
  return {
    scheduledStartTime: startTime,
    scheduledEndTime: endTime,
    actualStartTime: existing.completed || existing.actualStartTime ? startTime : null,
    actualEndTime: existing.completed || existing.actualEndTime ? endTime : null,
    duration: existing.completed && span !== null ? Math.max(1, span) : existing.duration ?? null,
  };
}
