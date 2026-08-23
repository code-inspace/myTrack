import { DailySleepLog } from "./types";
import { getStoredUserSession, DEMO_USER } from "@/features/auth/actions";
import { subtractMinutesFromTime } from "@/lib/dates";
import { scheduleTaskPushNotification } from "@/lib/onesignal/client";
import { subDays, parseISO, format } from "date-fns";

const SLEEP_STORAGE_PREFIX = "mytrack_sleeplog_";

export function getEffectiveUserId(explicitUserId?: string): string {
  if (explicitUserId) return explicitUserId;
  const session = getStoredUserSession();
  return session?.id || DEMO_USER.id;
}

export const BEDTIME_OFFSET_OPTIONS = [
  { value: 60, label: "1h" },
  { value: 30, label: "30 min" },
  { value: 20, label: "20 min" },
  { value: 15, label: "15 min" },
  { value: 0, label: "À l'heure" },
];

export const DEFAULT_BEDTIME_OFFSETS = [60, 30, 15];

/**
 * Calculates bedtime reminder times from an array of minute offsets
 */
export function computeBedtimeRemindersFromOffsets(bedtime: string, offsets: number[] = DEFAULT_BEDTIME_OFFSETS): string[] {
  if (!bedtime) return ["22:00", "22:30", "22:45"];
  const sorted = [...offsets].sort((a, b) => b - a);
  return sorted.map((offset) =>
    offset === 0 ? bedtime : subtractMinutesFromTime(bedtime, offset)
  );
}

/**
 * Calculates 3 default bedtime reminders:
 * 1. 1 hour (60 min) before
 * 2. 30 minutes before
 * 3. 15 minutes before
 */
export function computeDefaultBedtimeReminders(bedtime: string): string[] {
  return computeBedtimeRemindersFromOffsets(bedtime, DEFAULT_BEDTIME_OFFSETS);
}

/**
 * Calculates sleep duration string between bedtime and wakeTime
 */
export function computeSleepDuration(
  bedtime?: string | null,
  wakeTime?: string | null
): { hours: number; minutes: number; text: string; decHours: number } | null {
  if (!bedtime || !wakeTime) return null;

  const [bH, bM] = bedtime.split(":").map((v) => parseInt(v, 10) || 0);
  const [wH, wM] = wakeTime.split(":").map((v) => parseInt(v, 10) || 0);

  let bedMinutes = bH * 60 + bM;
  let wakeMinutes = wH * 60 + wM;

  if (wakeMinutes <= bedMinutes) {
    // Crosses midnight
    wakeMinutes += 24 * 60;
  }

  const diff = wakeMinutes - bedMinutes;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  const decHours = Math.round((hours + minutes / 60) * 10) / 10;

  return {
    hours,
    minutes,
    decHours,
    text: `${hours}h ${String(minutes).padStart(2, "0")}m`,
  };
}

export function getStoredSleepLog(date: string, userId?: string): DailySleepLog {
  const targetId = getEffectiveUserId(userId);
  const key = `${SLEEP_STORAGE_PREFIX}${targetId}_${date}`;

  if (typeof window === "undefined") {
    return {
      date,
      bedtime: "23:00",
      wakeTime: "07:00",
      bedtimeValidated: false,
      wakeTimeValidated: false,
      bedtimeOffsets: DEFAULT_BEDTIME_OFFSETS,
      bedtimeReminders: ["22:00", "22:30", "22:45"],
      enableBedtimeReminders: true,
      notes: "",
    };
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        bedtimeOffsets: parsed.bedtimeOffsets || DEFAULT_BEDTIME_OFFSETS,
      };
    }
  } catch (err) {
    console.warn("getStoredSleepLog parse error:", err);
  }

  // Default initial sleep log
  const defaultBedtime = "23:00";
  return {
    date,
    bedtime: defaultBedtime,
    wakeTime: "07:00",
    bedtimeValidated: false,
    wakeTimeValidated: false,
    bedtimeOffsets: DEFAULT_BEDTIME_OFFSETS,
    bedtimeReminders: computeDefaultBedtimeReminders(defaultBedtime),
    enableBedtimeReminders: true,
    notes: "",
  };
}

/**
 * Calculates sleep duration for a night leading into day D:
 * Requires bedtime of eve (D-1) and wakeTime of morning (D) to be validated.
 */
export function getNightSleepDuration(
  wakeDateStr: string,
  userId?: string
): {
  duration: { hours: number; minutes: number; text: string; decHours: number };
  yesterdayBedtime: string;
  todayWakeTime: string;
} | null {
  try {
    const d = parseISO(wakeDateStr);
    const yesterdayStr = format(subDays(d, 1), "yyyy-MM-dd");

    const yesterdayLog = getStoredSleepLog(yesterdayStr, userId);
    const todayLog = getStoredSleepLog(wakeDateStr, userId);

    const hasYesterdayBedtime = Boolean(
      yesterdayLog.bedtime && (yesterdayLog.bedtimeValidated || yesterdayLog.updatedAt)
    );
    const hasTodayWakeTime = Boolean(
      todayLog.wakeTime && (todayLog.wakeTimeValidated || todayLog.updatedAt)
    );

    if (!hasYesterdayBedtime || !hasTodayWakeTime) {
      return null;
    }

    const duration = computeSleepDuration(yesterdayLog.bedtime, todayLog.wakeTime);
    if (!duration) return null;

    return {
      duration,
      yesterdayBedtime: yesterdayLog.bedtime || "23:00",
      todayWakeTime: todayLog.wakeTime || "07:00",
    };
  } catch (err) {
    console.warn("getNightSleepDuration error:", err);
    return null;
  }
}

export async function saveStoredSleepLog(
  log: DailySleepLog,
  userId?: string
): Promise<DailySleepLog> {
  const targetId = getEffectiveUserId(userId);
  const key = `${SLEEP_STORAGE_PREFIX}${targetId}_${log.date}`;
  const nowIso = new Date().toISOString();

  const updatedLog: DailySleepLog = {
    ...log,
    updatedAt: nowIso,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(updatedLog));
    } catch (err) {
      console.warn("saveStoredSleepLog storage error:", err);
    }
  }

  // Schedule OneSignal bedtime push notifications if enabled
  if (updatedLog.enableBedtimeReminders && updatedLog.bedtimeReminders?.length > 0) {
    for (const rTime of updatedLog.bedtimeReminders) {
      scheduleTaskPushNotification({
        userId: targetId,
        taskTitle: `Préparation au Sommeil (Coucher à ${updatedLog.bedtime})`,
        startTime: rTime,
        reminderOffsetMinutes: 0,
        date: updatedLog.date,
        category: "Sleep",
      }).catch((err) => console.warn("Bedtime reminder schedule error:", err));
    }
  }

  return updatedLog;
}
