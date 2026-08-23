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

  let rawNotes = row.notes || "";
  let gratitude = row.gratitude || "";
  let manifestation = row.manifestation || "";

  // Check if gratitude/manifestation were stored in JSON format inside notes
  if (rawNotes && typeof rawNotes === "string" && rawNotes.startsWith("{") && rawNotes.includes("gratitude")) {
    try {
      const parsed = JSON.parse(rawNotes);
      rawNotes = parsed.notes || "";
      if (!gratitude) gratitude = parsed.gratitude || "";
      if (!manifestation) manifestation = parsed.manifestation || "";
    } catch {}
  }

  return {
    date: row.date,
    bedtime: localBedtime,
    wakeTime: localWakeTime,
    bedtimeValidated: Boolean(row.bedtime_validated),
    wakeTimeValidated: Boolean(row.wake_time_validated),
    bedtimeOffsets: offsets,
    bedtimeReminders: localReminders,
    enableBedtimeReminders: row.enable_bedtime_reminders !== false,
    notes: rawNotes,
    gratitude,
    manifestation,
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
      gratitude: "",
      manifestation: "",
    };
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        bedtimeOffsets: parsed.bedtimeOffsets || DEFAULT_BEDTIME_OFFSETS,
        gratitude: parsed.gratitude || "",
        manifestation: parsed.manifestation || "",
      };
    }
  } catch (err) {
    console.warn("getStoredSleepLog parse error:", err);
  }

  // Default initial sleep log
  const defaultBedtime = "23:00";
  return {