import { DailySleepLog } from "./types";
import { getStoredUserSession, DEMO_USER } from "@/features/auth/actions";
import { subtractMinutesFromTime } from "@/lib/dates";
import { scheduleTaskPushNotification } from "@/lib/onesignal/client";

const SLEEP_STORAGE_PREFIX = "mytrack_sleeplog_";

export function getEffectiveUserId(explicitUserId?: string): string {
  if (explicitUserId) return explicitUserId;
  const session = getStoredUserSession();
  return session?.id || DEMO_USER.id;
}

/**
 * Calculates 3 default bedtime reminders:
 * 1. 1 hour (60 min) before
 * 2. 30 minutes before
 * 3. 15 minutes before
 */
export function computeDefaultBedtimeReminders(bedtime: string): string[] {
  if (!bedtime) return ["22:00", "22:30", "22:45"];
  return [
    subtractMinutesFromTime(bedtime, 60),
    subtractMinutesFromTime(bedtime, 30),
    subtractMinutesFromTime(bedtime, 15),
  ];
}

/**
 * Calculates sleep duration string between bedtime and wakeTime
 */
export function computeSleepDuration(bedtime: string, wakeTime: string): { hours: number; minutes: number; text: string } {
  if (!bedtime || !wakeTime) return { hours: 8, minutes: 0, text: "8h 00m" };

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

  return {
    hours,
    minutes,
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
      bedtimeReminders: ["22:00", "22:30", "22:45"],
      enableBedtimeReminders: true,
      notes: "",
    };
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
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
    bedtimeReminders: computeDefaultBedtimeReminders(defaultBedtime),
    enableBedtimeReminders: true,
    notes: "",
  };
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
