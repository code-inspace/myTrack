import { DailySleepLog, NapSession } from "./types";
import { getStoredSleepLog, saveStoredSleepLog } from "./actions";
import { getTodayDateString, addHoursToTimeString } from "@/lib/dates";

/**
 * Checks if a task title or text refers to a nap ("sieste", "nap", "micro-sieste", etc.)
 * Case-insensitive, accent-insensitive, word-boundary safe.
 */
export function isNapTitle(title?: string | null): boolean {
  if (!title) return false;
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /\b(sieste|siestes|nap|naps|micro-sieste|micro-siestes|microsieste|microsiestes)\b/i.test(
    normalized
  );
}

/**
 * Synchronizes a task with the daily sleep log's nap sessions.
 * If the task is a nap, it adds/updates a corresponding nap in DailySleepLog.naps.
 * If the task title is no longer a nap, it cleans up any existing nap linked to this task.
 */
export async function syncTaskWithSleepNaps(
  task: {
    id: string;
    title: string;
    startTime?: string | null;
    endTime?: string | null;
    trackingType?: string;
    targetValue?: number | null;
    createdAt?: string;
    userId?: string;
  },
  explicitDate?: string,
  previousDate?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  const dateStr =
    explicitDate ||
    (task.createdAt ? task.createdAt.split("T")[0] : getTodayDateString());
  const targetId = task.userId;
  const napId = `task-nap-${task.id}`;

  if (isNapTitle(task.title)) {
    const startTime = task.startTime || "13:30";
    let endTime = task.endTime;

    if (!endTime) {
      if (task.trackingType === "DURATION" && task.targetValue && task.targetValue > 0) {
        endTime = addHoursToTimeString(startTime, task.targetValue / 60);
      } else {
        // Default 30 min duration
        endTime = addHoursToTimeString(startTime, 0.5);
      }
    }

    const currentLog = getStoredSleepLog(dateStr, targetId);
    const existingNaps = currentLog.naps || [];

    const napSession: NapSession = {
      id: napId,
      taskId: task.id,
      title: task.title,
      startTime,
      endTime,
    };

    const nextNaps = existingNaps.some((n) => n.id === napId || n.taskId === task.id)
      ? existingNaps.map((n) => (n.id === napId || n.taskId === task.id ? napSession : n))
      : [...existingNaps, napSession];

    await saveStoredSleepLog(
      {
        ...currentLog,
        naps: nextNaps,
      },
      targetId
    );

    // Clean previous date if task was moved to a different day
    if (previousDate && previousDate !== dateStr) {
      await removeTaskFromSleepNaps(task.id, previousDate, targetId);
    }

    window.dispatchEvent(
      new CustomEvent("mytrack:sleep-auto-detected", {
        detail: {
          nap: napSession,
          wakeDate: dateStr,
          type: "nap",
        },
      })
    );
  } else {
    // If the title is not a nap, ensure any previous nap linked to this task is removed
    await removeTaskFromSleepNaps(task.id, dateStr, targetId);
    if (previousDate && previousDate !== dateStr) {
      await removeTaskFromSleepNaps(task.id, previousDate, targetId);
    }
  }
}

/**
 * Removes any nap session linked to a specific task ID from the daily sleep log.
 */
export async function removeTaskFromSleepNaps(
  taskId: string,
  explicitDate?: string,
  userId?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  const napId = `task-nap-${taskId}`;

  const cleanLogForDate = async (date: string) => {
    const log = getStoredSleepLog(date, userId);
    if (!log.naps || log.naps.length === 0) return;

    const filteredNaps = log.naps.filter(
      (n) => n.id !== napId && n.id !== taskId && n.taskId !== taskId
    );

    if (filteredNaps.length !== log.naps.length) {
      await saveStoredSleepLog(
        {
          ...log,
          naps: filteredNaps,
        },
        userId
      );
      window.dispatchEvent(
        new CustomEvent("mytrack:sleep-auto-detected", {
          detail: {
            wakeDate: date,
            type: "nap-deleted",
          },
        })
      );
    }
  };

  if (explicitDate) {
    await cleanLogForDate(explicitDate);
  } else {
    // Look through all localStorage sleep log keys for this user
    try {
      const keysToSearch: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mytrack_sleeplog_")) {
          keysToSearch.push(k);
        }
      }

      for (const k of keysToSearch) {
        try {
          const raw = localStorage.getItem(k);
          if (raw && (raw.includes(napId) || raw.includes(taskId))) {
            const parsed: DailySleepLog = JSON.parse(raw);
            if (parsed.date) {
              await cleanLogForDate(parsed.date);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn("removeTaskFromSleepNaps search error:", e);
    }
  }
}
