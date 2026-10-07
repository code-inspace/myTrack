import { DailySleepLog, NapSession } from "./types";
import { isNightSleepHour, isEveningBedtimeHour, SLEEP_MORNING_END_HOUR } from "./sleepRules";
import { getStoredSleepLog, saveStoredSleepLog } from "./actions";
import { getTodayDateString, addHoursToTimeString } from "@/lib/dates";
import { format, parseISO, subDays, addDays } from "date-fns";

const EXCLUDED_NON_SLEEP_ACTIVITIES =
  /\b(podcast|meditation|livre|lecture|musique|quiz|test|respiration|etirement|etirements)\b/i;

/**
 * Checks if a task title refers to a nap ("sieste", "nap", "micro-sieste", etc.)
 * Case-insensitive, accent-insensitive, word-boundary safe.
 */
export function isNapTitle(title?: string | null): boolean {
  if (!title) return false;
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (EXCLUDED_NON_SLEEP_ACTIVITIES.test(normalized)) {
    return false;
  }

  return /\b(sieste|siestes|nap|naps|micro-sieste|micro-siestes|microsieste|microsiestes)\b/i.test(
    normalized
  );
}

/**
 * Checks if a task title refers to night sleep ("sommeil", "dodo", "dormir", "sleep", "nuit", etc.)
 * Case-insensitive, accent-insensitive, word-boundary safe.
 */
export function isSleepTitle(title?: string | null): boolean {
  if (!title) return false;
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (EXCLUDED_NON_SLEEP_ACTIVITIES.test(normalized)) {
    return false;
  }

  return /\b(sommeil|sommeils|dodo|dodos|dormir|sleep|nuitee|nuitees|nuit|nuits)\b/i.test(
    normalized
  );
}

/**
 * Checks if a task title refers to either sleep or a nap.
 */
export function isSleepOrNapTitle(title?: string | null): boolean {
  return isNapTitle(title) || isSleepTitle(title);
}

/**
 * Attempts to extract time ranges formatted as:
 * - "23h - 7h" or "23h 7h" or "23h-7h"
 * - "22:30 - 06:30" or "22:30 06:30"
 * - "22h30 - 6h30" or "22h30 6h30"
 * - "14h - 15h"
 * Returns the cleaned title and extracted startTime / endTime (formatted as "HH:MM").
 */
export function extractTimesFromTitle(title?: string | null): {
  cleanTitle: string;
  startTime?: string;
  endTime?: string;
} {
  if (!title) return { cleanTitle: "" };

  const raw = title.trim();

  // Pattern: 22h30 or 22:30 or 22h
  const timePartRegex = /(\d{1,2})(?:[h:](\d{2}))?h?/i;
  // Full range: <timePart> (separator: -, à, a, to, or spaces) <timePart>
  const rangeRegex =
    /^(.*?)(?:\s*(?:-|à|a|to)\s*|\s+)(\d{1,2}(?:[h:]\d{2}|h)?)\s*(?:-|à|a|to|\s+)\s*(\d{1,2}(?:[h:]\d{2}|h)?)\s*$/i;

  const match = raw.match(rangeRegex);
  if (match) {
    const textPrefix = match[1].trim();
    const rawStart = match[2].trim();
    const rawEnd = match[3].trim();

    const parsePart = (val: string): string | undefined => {
      const p = val.match(timePartRegex);
      if (!p) return undefined;
      const h = parseInt(p[1], 10);
      const m = p[2] ? parseInt(p[2], 10) : 0;
      if (isNaN(h) || h < 0 || h > 24) return undefined;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const startTime = parsePart(rawStart);
    const endTime = parsePart(rawEnd);

    if (startTime && endTime) {
      return {
        cleanTitle: textPrefix || raw,
        startTime,
        endTime,
      };
    }
  }

  return { cleanTitle: raw };
}

/**
 * Synchronizes a task with DailySleepLog:
 * - If it's a nap: adds/updates a nap session in DailySleepLog.naps
 * - If it's sleep: sets bedtime and wakeTime in DailySleepLog (with validated badges & taskId link)
 * - If it's no longer a sleep/nap task: cleans up any existing links
 */
export async function syncTaskWithSleepLog(
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
  const todayStr = getTodayDateString();

  // Tasks scheduled on future dates are goals/plans, NOT validated recorded sleep logs
  if (dateStr > todayStr) {
    return;
  }

  const targetId = task.userId;
  const napId = `task-nap-${task.id}`;

  if (isNapTitle(task.title)) {
    const startTime = task.startTime || "13:30";
    let endTime = task.endTime;

    if (!endTime) {
      if (task.trackingType === "DURATION" && task.targetValue && task.targetValue > 0) {
        endTime = addHoursToTimeString(startTime, task.targetValue / 60);
      } else {
        endTime = addHoursToTimeString(startTime, 0.5); // Default 30 min duration
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

    if (previousDate && previousDate !== dateStr) {
      await removeTaskFromSleepLog(task.id, previousDate, targetId);
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
  } else if (isSleepTitle(task.title)) {
    // Night sleep task
    const startTime = task.startTime || "23:00";
    let endTime = task.endTime;

    if (!endTime) {
      if (task.trackingType === "DURATION" && task.targetValue && task.targetValue > 0) {
        endTime = addHoursToTimeString(startTime, task.targetValue / 60);
      } else {
        endTime = "07:00"; // Default wake time
      }
    }

    const startHour = parseInt(startTime.split(":")[0], 10) || 0;
    const endHour = parseInt(endTime.split(":")[0], 10) || 0;

    // Daytime sleep (e.g. 10h - 12h, 13h - 15h) treated as nap session regardless of title
    const isDaytime = !isNightSleepHour(startHour);
    if (isDaytime) {
      const currentLog = getStoredSleepLog(dateStr, targetId);
      const existingNaps = currentLog.naps || [];

      let validEndTime = endTime;
      // Guard against invalid/inverted end time during day
      if (endHour <= startHour) {
        validEndTime = addHoursToTimeString(startTime, 1);
      }

      const napSession: NapSession = {
        id: napId,
        taskId: task.id,
        title: task.title,
        startTime,
        endTime: validEndTime,
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

      window.dispatchEvent(
        new CustomEvent("mytrack:sleep-auto-detected", {
          detail: {
            nap: napSession,
            wakeDate: dateStr,
            type: "nap",
          },
        })
      );
      return;
    }

    // Determine bedDate and wakeDate for main night sleep
    // - Standard overnight sleep (e.g. 23:00 -> 07:00, or 22h -> 6h):
    //   bedDate is dateStr, wakeDate is dateStr + 1 day.
    // - Early morning sleep starting after midnight (e.g. 02:00 -> 09:00 scheduled on dateStr morning):
    //   wakeDate is dateStr (the morning of wake-up).
    //   bedDate is dateStr - 1 day (the eve to which this night's sleep belongs in the data model).
    let bedDate = dateStr;
    let wakeDate = dateStr;

    if (isEveningBedtimeHour(startHour)) {
      bedDate = dateStr;
      wakeDate = format(addDays(parseISO(dateStr), 1), "yyyy-MM-dd");
    } else if (startHour < SLEEP_MORNING_END_HOUR) {
      bedDate = format(subDays(parseISO(dateStr), 1), "yyyy-MM-dd");
      wakeDate = dateStr;

      // If an evening bedtime already exists on bedDate from another task, keep it as the primary night
      // and record this early morning session as a nap on wakeDate.
      const existingBedLog = getStoredSleepLog(bedDate, targetId);
      const hasExistingEvening =
        existingBedLog.bedtimeValidated &&
        existingBedLog.bedtime &&
        isEveningBedtimeHour(parseInt(existingBedLog.bedtime.split(":")[0], 10)) &&
        existingBedLog.taskId &&
        existingBedLog.taskId !== task.id;

      if (hasExistingEvening) {
        const napSession: NapSession = {
          id: napId,
          taskId: task.id,
          title: task.title,
          startTime,
          endTime,
        };
        const currentWakeLog = getStoredSleepLog(wakeDate, targetId);
        const existingNaps = currentWakeLog.naps || [];
        const nextNaps = existingNaps.some((n) => n.id === napId || n.taskId === task.id)
          ? existingNaps.map((n) => (n.id === napId || n.taskId === task.id ? napSession : n))
          : [...existingNaps, napSession];

        await saveStoredSleepLog(
          {
            ...currentWakeLog,
            naps: nextNaps,
          },
          targetId
        );

        window.dispatchEvent(
          new CustomEvent("mytrack:sleep-auto-detected", {
            detail: {
              nap: napSession,
              wakeDate,
              type: "nap",
            },
          })
        );
        return;
      }
    }

    // 1. Bedtime saved on bedDate
    const bedLog = getStoredSleepLog(bedDate, targetId);
    await saveStoredSleepLog(
      {
        ...bedLog,
        bedtime: startTime,
        bedtimeValidated: true,
        taskId: task.id,
      },
      targetId
    );

    // 2. WakeTime saved on wakeDate
    const wakeLog = getStoredSleepLog(wakeDate, targetId);
    await saveStoredSleepLog(
      {
        ...wakeLog,
        wakeTime: endTime,
        wakeTimeValidated: true,
        taskId: task.id,
      },
      targetId
    );

    // Clean previous date if task was moved to a different day
    if (previousDate && previousDate !== dateStr) {
      await removeTaskFromSleepLog(task.id, previousDate, targetId);
    }

    window.dispatchEvent(
      new CustomEvent("mytrack:sleep-auto-detected", {
        detail: {
          taskId: task.id,
          bedDate,
          wakeDate,
          bedtime: startTime,
          wakeTime: endTime,
          type: "sleep",
        },
      })
    );
  } else {
    // If title is neither nap nor sleep, ensure any previous sleep/nap linked to this task is removed
    await removeTaskFromSleepLog(task.id, dateStr, targetId);
    if (previousDate && previousDate !== dateStr) {
      await removeTaskFromSleepLog(task.id, previousDate, targetId);
    }
  }
}

/**
 * Removes any sleep log or nap session linked to a specific task ID.
 */
export async function removeTaskFromSleepLog(
  taskId: string,
  explicitDate?: string,
  userId?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  const napId = `task-nap-${taskId}`;

  const cleanLogForDate = async (date: string) => {
    const log = getStoredSleepLog(date, userId);
    let modified = false;
    let nextNaps = log.naps || [];

    if (log.naps && log.naps.length > 0) {
      const filteredNaps = log.naps.filter(
        (n) => n.id !== napId && n.id !== taskId && n.taskId !== taskId
      );
      if (filteredNaps.length !== log.naps.length) {
        nextNaps = filteredNaps;
        modified = true;
      }
    }

    // Clean night sleep link if linked to this task
    let nextBedtime = log.bedtime;
    let nextBedtimeValidated = log.bedtimeValidated;
    let nextWakeTime = log.wakeTime;
    let nextWakeTimeValidated = log.wakeTimeValidated;
    let nextTaskId = log.taskId;

    if (log.taskId === taskId) {
      nextTaskId = undefined;
      nextBedtimeValidated = false;
      nextWakeTimeValidated = false;
      modified = true;
    }

    if (modified) {
      await saveStoredSleepLog(
        {
          ...log,
          bedtime: nextBedtime,
          bedtimeValidated: nextBedtimeValidated,
          wakeTime: nextWakeTime,
          wakeTimeValidated: nextWakeTimeValidated,
          naps: nextNaps,
          taskId: nextTaskId,
        },
        userId
      );

      window.dispatchEvent(
        new CustomEvent("mytrack:sleep-auto-detected", {
          detail: {
            wakeDate: date,
            type: "sleep-deleted",
          },
        })
      );
    }
  };

  if (explicitDate) {
    await cleanLogForDate(explicitDate);
    const prevDate = format(subDays(parseISO(explicitDate), 1), "yyyy-MM-dd");
    const nextDate = format(addDays(parseISO(explicitDate), 1), "yyyy-MM-dd");
    await cleanLogForDate(prevDate);
    await cleanLogForDate(nextDate);
  } else {
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
      console.warn("removeTaskFromSleepLog search error:", e);
    }
  }
}

// Backward-compatibility aliases
export const syncTaskWithSleepNaps = syncTaskWithSleepLog;
export const removeTaskFromSleepNaps = removeTaskFromSleepLog;
