import { format } from "date-fns";
import {
  updateTaskSchedule,
  closeTaskAsCompleted,
  updateDbTaskActive,
} from "@/features/tasks/actions";
import { NativeNotifications } from "@/lib/native/localNotifications";
import { formatClock } from "./plan";
import type { RunItem } from "./types";

const ALERT_TYPE = "session_alert";
/** Native notification ids to cancel when the timer changes */
let nativeIds: string[] = [];

/** Marks a session task as done with what really happened (real slot and real duration). */
export async function completeSessionTask(item: RunItem, userId: string) {
  if (!item.taskId || item.startedAtMs === null) return;
  const startMs = item.startedAtMs;
  const endMs = startMs + item.actualMs + item.pausedMs;
  const date = format(new Date(startMs), "yyyy-MM-dd");
  try {
    await updateTaskSchedule({
      taskId: item.taskId,
      date,
      startTime: formatClock(startMs),
      endTime: formatClock(endMs),
      applyToAll: !item.recurring,
      userId,
    });
    await closeTaskAsCompleted(item.taskId, date, userId, {
      duration: Math.max(1, Math.round(item.actualMs / 60_000)),
    });
  } catch (err) {
    console.warn("completeSessionTask note:", err);
  }
}

export function setTaskActive(taskId: string | null, active: boolean, userId: string) {
  if (!taskId) return;
  updateDbTaskActive(taskId, active, userId).catch(() => {});
}

/**
 * Best effort alerts for when the screen is locked or the app is in the background: a push
 * "plus que 5 minutes" and one at the end. In the page itself the countdown does the job.
 */
export async function scheduleSessionAlerts(title: string, warnInMs: number | null, endInMs: number) {
  await cancelSessionAlerts();
  const send = async (inMs: number, message: string) => {
    if (inMs <= 5_000) return;
    try {
      if (NativeNotifications.isSupported()) {
        const id = `${ALERT_TYPE}-${Date.now()}-${Math.round(inMs)}`;
        nativeIds.push(id);
        await NativeNotifications.scheduleNotification({
          id,
          title,
          body: message,
          scheduleAt: new Date(Date.now() + inMs),
        });
      } else {
        await fetch("/api/notifications/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: title,
            targetInMinutes: inMs / 60_000,
            customMessage: message,
            type: ALERT_TYPE,
          }),
        });
      }
    } catch {
      // alerts are an extra, never a blocker
    }
  };
  if (warnInMs !== null) await send(warnInMs, "Plus que 5 minutes");
  await send(endInMs, "Le temps est écoulé");
}

export async function cancelSessionAlerts() {
  try {
    if (NativeNotifications.isSupported()) {
      const ids = nativeIds;
      nativeIds = [];
      await Promise.all(ids.map((id) => NativeNotifications.cancelNotification(id)));
    } else {
      await fetch("/api/notifications/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderType: ALERT_TYPE }),
      });
    }
  } catch {
    // ignore
  }
}
