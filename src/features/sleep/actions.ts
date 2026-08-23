import { DailySleepLog } from "./types";
import { getStoredUserSession, DEMO_USER } from "@/features/auth/actions";
import {
  subtractMinutesFromTime,
  createUtcIsoFromLocalDateTime,
  convertLocalTimeToUtc,
  convertUtcTimeToLocal,
} from "@/lib/dates";
import { scheduleTaskPushNotification } from "@/lib/onesignal/client";
import { createDbReminder } from "@/features/notifications/reminderActions";
import { createClient } from "@/utils/supabase/client";
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
export function computeBedtimeRemindersFromOffsets(
  bedtime: string,
  offsets: number[] = DEFAULT_BEDTIME_OFFSETS
): string[] {
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

function mapDbSleepLogToModel(row: any): DailySleepLog {
  const localBedtime = convertUtcTimeToLocal(row.bedtime || "23:00", row.date);
  const localWakeTime = convertUtcTimeToLocal(row.wake_time || "07:00", row.date);
  const offsets = row.bedtime_offsets || DEFAULT_BEDTIME_OFFSETS;
  const localReminders = row.bedtime_reminders && row.bedtime_reminders.length > 0
    ? row.bedtime_reminders.map((r: string) => convertUtcTimeToLocal(r, row.date))
    : computeBedtimeRemindersFromOffsets(localBedtime, offsets);

  return {
    date: row.date,
    bedtime: localBedtime,
    wakeTime: localWakeTime,
    bedtimeValidated: Boolean(row.bedtime_validated),
    wakeTimeValidated: Boolean(row.wake_time_validated),
    bedtimeOffsets: offsets,
    bedtimeReminders: localReminders,
    enableBedtimeReminders: row.enable_bedtime_reminders !== false,
    notes: row.notes || "",
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Fetches sleep log from Supabase database with local storage synchronization
 */
export async function fetchDbSleepLog(date: string, userId?: string): Promise<DailySleepLog> {
  const supabase = createClient();
  let targetId = userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const key = `${SLEEP_STORAGE_PREFIX}${targetId}_${date}`;

  try {
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", targetId)
      .eq("date", date)
      .maybeSingle();

    if (!error && data) {
      const mapped = mapDbSleepLogToModel(data);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(mapped));
      }
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchDbSleepLog error:", err);
  }

  return getStoredSleepLog(date, targetId);
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

/**
 * Saves sleep log to Supabase PostgreSQL database and updates localStorage
 */
export async function saveStoredSleepLog(
  log: DailySleepLog,
  userId?: string
): Promise<DailySleepLog> {
  const supabase = createClient();
  let targetId = userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const key = `${SLEEP_STORAGE_PREFIX}${targetId}_${log.date}`;
  const nowIso = new Date().toISOString();

  const updatedLog: DailySleepLog = {
    ...log,
    updatedAt: nowIso,
  };

  // 1. Instant local persistence
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(updatedLog));
    } catch (err) {
      console.warn("saveStoredSleepLog local storage error:", err);
    }
  }

  // 2. Database persistence in Supabase (Timezone normalized to UTC)
  try {
    const utcBedtime = convertLocalTimeToUtc(updatedLog.bedtime || "23:00", updatedLog.date);
    const utcWakeTime = convertLocalTimeToUtc(updatedLog.wakeTime || "07:00", updatedLog.date);
    const utcReminders = (updatedLog.bedtimeReminders || []).map((r) =>
      convertLocalTimeToUtc(r, updatedLog.date)
    );

    const { error } = await supabase.from("sleep_logs").upsert(
      [
        {
          user_id: targetId,
          date: updatedLog.date,
          bedtime: utcBedtime,
          wake_time: utcWakeTime,
          bedtime_validated: Boolean(updatedLog.bedtimeValidated),
          wake_time_validated: Boolean(updatedLog.wakeTimeValidated),
          bedtime_offsets: updatedLog.bedtimeOffsets || DEFAULT_BEDTIME_OFFSETS,
          bedtime_reminders: utcReminders,
          enable_bedtime_reminders: updatedLog.enableBedtimeReminders !== false,
          notes: updatedLog.notes || null,
          updated_at: nowIso,
        },
      ],
      { onConflict: "user_id,date" }
    );

    if (error) {
      console.warn("Supabase saveStoredSleepLog error:", error);
    }
  } catch (err) {
    console.warn("Supabase saveStoredSleepLog network fallback:", err);
  }

  // 3. Schedule OneSignal bedtime push notifications & database reminder records if enabled
  if (updatedLog.enableBedtimeReminders && updatedLog.bedtimeReminders?.length > 0) {
    for (const rTime of updatedLog.bedtimeReminders) {
      const scheduledIso = createUtcIsoFromLocalDateTime(rTime, updatedLog.date);

      // Record in Supabase reminders table
      createDbReminder({
        userId: targetId || getEffectiveUserId(userId),
        title: "🌙 Préparation au Sommeil",
        body: `C'est l'heure de te préparer pour ton coucher prévu à ${updatedLog.bedtime || "23:00"} !`,
        scheduledAt: scheduledIso,
        reminderType: "bedtime",
      }).catch((e) => console.warn("Bedtime reminder DB record error:", e));

      // Push via OneSignal
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

/**
 * Fetches multi-day sleep history from Supabase
 */
export async function fetchSleepHistory(
  days: number = 30,
  userId?: string
): Promise<DailySleepLog[]> {
  const supabase = createClient();
  let targetId = userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", targetId)
      .order("date", { ascending: false })
      .limit(days);

    if (!error && data) {
      return data.map(mapDbSleepLogToModel);
    }
  } catch (err) {
    console.warn("Supabase fetchSleepHistory error:", err);
  }
  return [];
}
