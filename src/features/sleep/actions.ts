import { DailySleepLog, NapSession } from "./types";
import { getStoredUserSession } from "@/features/auth/actions";
import {
  subtractMinutesFromTime,
  createUtcIsoFromLocalDateTime,
  convertLocalTimeToUtc,
  convertUtcTimeToLocal,
} from "@/lib/dates";
import { scheduleTaskPushNotification, cancelTaskPushNotifications } from "@/lib/onesignal/client";
import { createDbReminder } from "@/features/notifications/reminderActions";
import { createClient } from "@/utils/supabase/client";
import { subDays, parseISO, format } from "date-fns";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";

const SLEEP_STORAGE_PREFIX = "mytrack_sleeplog_";

export function getEffectiveUserId(explicitUserId?: string): string {
  if (explicitUserId) return explicitUserId;
  const session = getStoredUserSession();
  return session?.id || "";
}

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

function currentLocalTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * A "coucher"/"réveil" quick action pressed between 20:00 and 06:00 is assumed to be the main
 * night's sleep; outside that window it's assumed to be a daytime nap.
 */
function isNightWindow(timeStr: string): boolean {
  const hour = parseInt(timeStr.split(":")[0], 10) || 0;
  return hour >= 20 || hour < 6;
}

function getOpenNap(log: DailySleepLog): NapSession | null {
  const naps = log.naps || [];
  return naps.find((n) => n.endTime === null) || null;
}

/**
 * Applies "Je me couche maintenant": starts tonight's bedtime during the night window, or opens
 * a new nap session at any other time of day.
 */
export function applySleepStartNow(log: DailySleepLog): DailySleepLog {
  const now = currentLocalTimeStr();

  if (isNightWindow(now)) {
    return {
      ...log,
      bedtime: now,
      bedtimeValidated: true,
    };
  }

  if (getOpenNap(log)) return log; // a nap is already in progress

  const nap: NapSession = { id: `nap_${Date.now()}`, startTime: now, endTime: null };
  return { ...log, naps: [...(log.naps || []), nap] };
}

/**
 * Applies "Je me réveille maintenant": closes an in-progress nap if there is one, otherwise
 * records the main morning wake-up time.
 */
export function applySleepEndNow(log: DailySleepLog): DailySleepLog {
  const now = currentLocalTimeStr();
  const openNap = getOpenNap(log);

  if (openNap) {
    return {
      ...log,
      naps: (log.naps || []).map((n) => (n.id === openNap.id ? { ...n, endTime: now } : n)),
    };
  }

  return { ...log, wakeTime: now, wakeTimeValidated: true };
}

function mapDbSleepLogToModel(row: any): DailySleepLog {
  const localBedtime = convertUtcTimeToLocal(row.bedtime || "23:00", row.date);
  const localWakeTime = convertUtcTimeToLocal(row.wake_time || "07:00", row.date);

  let rawNotes = row.notes || "";
  let gratitude = row.gratitude || "";
  let manifestation = row.manifestation || "";
  let rawNaps: Array<{ id: string; startTime: string; endTime: string | null }> = Array.isArray(row.naps)
    ? row.naps
    : [];

  // Check if gratitude/manifestation/naps were stored in JSON format inside notes
  if (rawNotes && typeof rawNotes === "string" && rawNotes.startsWith("{") && rawNotes.includes("gratitude")) {
    try {
      const parsed = JSON.parse(rawNotes);
      rawNotes = parsed.notes || "";
      if (!gratitude) gratitude = parsed.gratitude || "";
      if (!manifestation) manifestation = parsed.manifestation || "";
      if (rawNaps.length === 0 && Array.isArray(parsed.naps)) rawNaps = parsed.naps;
    } catch {}
  }

  const naps: NapSession[] = rawNaps.map((n) => ({
    id: n.id,
    startTime: convertUtcTimeToLocal(n.startTime, row.date),
    endTime: n.endTime ? convertUtcTimeToLocal(n.endTime, row.date) : null,
  }));

  return {
    date: row.date,
    bedtime: localBedtime,
    wakeTime: localWakeTime,
    bedtimeValidated: Boolean(row.bedtime_validated),
    wakeTimeValidated: Boolean(row.wake_time_validated),
    naps,
    notes: rawNotes,
    gratitude,
    manifestation,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function mapDbSleepLogToModelAsync(row: any): Promise<DailySleepLog> {
  let rawNotes = row.notes || "";
  let gratitude = row.gratitude || "";
  let manifestation = row.manifestation || "";

  if (rawNotes && isEncrypted(rawNotes)) {
    rawNotes = await decryptText(rawNotes);
  }
  if (gratitude && isEncrypted(gratitude)) {
    gratitude = await decryptText(gratitude);
  }
  if (manifestation && isEncrypted(manifestation)) {
    manifestation = await decryptText(manifestation);
  }

  return mapDbSleepLogToModel({
    ...row,
    notes: rawNotes,
    gratitude,
    manifestation,
  });
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
      const mapped = await mapDbSleepLogToModelAsync(data);
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

/**
 * Persists a batch of fetched remote logs (e.g. from fetchSleepHistory) into localStorage so
 * that synchronous readers like getStoredSleepLog/getNightSleepDuration see multi-day history.
 */
export function cacheSleepHistoryLocally(logs: DailySleepLog[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  for (const log of logs) {
    try {
      const json = JSON.stringify(log);
      if (targetId) {
        localStorage.setItem(`${SLEEP_STORAGE_PREFIX}${targetId}_${log.date}`, json);
      }
      localStorage.setItem(`${SLEEP_STORAGE_PREFIX}_${log.date}`, json);
    } catch (err) {
      console.warn("cacheSleepHistoryLocally error:", err);
    }
  }
  try {
    window.dispatchEvent(new CustomEvent("mytrack:sleep-auto-detected"));
  } catch {}
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
      naps: [],
      notes: "",
      gratitude: "",
      manifestation: "",
    };
  }

  try {
    let raw = targetId ? localStorage.getItem(key) : null;
    if (!raw) {
      raw = localStorage.getItem(`${SLEEP_STORAGE_PREFIX}_${date}`);
    }
    if (!raw) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SLEEP_STORAGE_PREFIX) && k.endsWith(`_${date}`)) {
          raw = localStorage.getItem(k);
          if (raw) break;
        }
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        naps: parsed.naps || [],
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
    date,
    bedtime: defaultBedtime,
    wakeTime: "07:00",
    bedtimeValidated: false,
    wakeTimeValidated: false,
    naps: [],
    notes: "",
    gratitude: "",
    manifestation: "",
  };
}

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
      yesterdayLog.bedtime && (yesterdayLog.bedtimeValidated || yesterdayLog.updatedAt || yesterdayLog.bedtime !== "23:00")
    );
    const hasTodayWakeTime = Boolean(
      todayLog.wakeTime && (todayLog.wakeTimeValidated || todayLog.updatedAt || todayLog.wakeTime !== "07:00")
    );

    if (!hasYesterdayBedtime && !hasTodayWakeTime) {
      return null;
    }

    const bedtime = hasYesterdayBedtime
      ? (yesterdayLog.bedtime || "23:00")
      : (todayLog.bedtime || "23:00");
    const wakeTime = hasTodayWakeTime
      ? (todayLog.wakeTime || "07:00")
      : (todayLog.wakeTime || "07:00");

    const duration = computeSleepDuration(bedtime, wakeTime);
    if (!duration) return null;

    return {
      duration,
      yesterdayBedtime: bedtime,
      todayWakeTime: wakeTime,
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
  let targetId = getEffectiveUserId(userId);
  const nowIso = new Date().toISOString();

  const updatedLog: DailySleepLog = {
    ...log,
    updatedAt: nowIso,
  };

  // 1. Instant synchronous local persistence
  if (typeof window !== "undefined") {
    try {
      const immediateKey = `${SLEEP_STORAGE_PREFIX}${targetId}_${log.date}`;
      localStorage.setItem(immediateKey, JSON.stringify(updatedLog));
    } catch (err) {
      console.warn("saveStoredSleepLog local storage error:", err);
    }
  }

  const supabase = createClient();
  if (!targetId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      targetId = session?.user?.id || getEffectiveUserId();
    } catch {}
  }

  const key = `${SLEEP_STORAGE_PREFIX}${targetId}_${log.date}`;
  if (typeof window !== "undefined" && targetId) {
    try {
      localStorage.setItem(key, JSON.stringify(updatedLog));
    } catch {}
  }

  // 2. Database persistence in Supabase (Timezone normalized to UTC)
  try {
    const utcBedtime = convertLocalTimeToUtc(updatedLog.bedtime || "23:00", updatedLog.date);
    const utcWakeTime = convertLocalTimeToUtc(updatedLog.wakeTime || "07:00", updatedLog.date);
    const utcNaps = (updatedLog.naps || []).map((n) => ({
      id: n.id,
      startTime: convertLocalTimeToUtc(n.startTime, updatedLog.date),
      endTime: n.endTime ? convertLocalTimeToUtc(n.endTime, updatedLog.date) : null,
    }));

    const encryptedNotes = updatedLog.notes ? await encryptText(updatedLog.notes) : null;
    const encryptedGratitude = updatedLog.gratitude ? await encryptText(updatedLog.gratitude) : null;
    const encryptedManifestation = updatedLog.manifestation ? await encryptText(updatedLog.manifestation) : null;

    // Primary payload attempting direct column writes
    const payload: any = {
      user_id: targetId,
      date: updatedLog.date,
      bedtime: utcBedtime,
      wake_time: utcWakeTime,
      bedtime_validated: Boolean(updatedLog.bedtimeValidated),
      wake_time_validated: Boolean(updatedLog.wakeTimeValidated),
      naps: utcNaps,
      notes: encryptedNotes,
      gratitude: encryptedGratitude,
      manifestation: encryptedManifestation,
      updated_at: nowIso,
    };

    const { error } = await supabase.from("sleep_logs").upsert([payload], { onConflict: "user_id,date" });

    // Fallback if gratitude or manifestation column does not exist yet on remote table
    if (error) {
      console.warn("Supabase initial save error, trying resilient fallback:", error.message);
      const packedNotes = JSON.stringify({
        notes: updatedLog.notes || "",
        gratitude: updatedLog.gratitude || "",
        manifestation: updatedLog.manifestation || "",
        naps: utcNaps,
      });
      const encryptedPackedNotes = await encryptText(packedNotes);

      const fallbackPayload: any = {
        user_id: targetId,
        date: updatedLog.date,
        bedtime: utcBedtime,
        wake_time: utcWakeTime,
        bedtime_validated: Boolean(updatedLog.bedtimeValidated),
        wake_time_validated: Boolean(updatedLog.wakeTimeValidated),
        notes: encryptedPackedNotes,
        updated_at: nowIso,
      };

      const fallbackRes = await supabase.from("sleep_logs").upsert([fallbackPayload], { onConflict: "user_id,date" });
      if (fallbackRes.error) {
        console.warn("Supabase resilient save error:", fallbackRes.error);
      }
    }
  } catch (err) {
    console.warn("Supabase saveStoredSleepLog network fallback:", err);
  }

  // 3. Cancel any existing OneSignal bedtime push notifications & database reminder records
  const bedtimeTaskId = `sleep_bedtime_${targetId}`;
  Promise.resolve(
    cancelTaskPushNotifications({
      taskId: bedtimeTaskId,
      userId: targetId,
      reminderType: "bedtime",
    })
  ).catch(() => {});

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
      const mapped = data.map(mapDbSleepLogToModel);
      cacheSleepHistoryLocally(mapped, targetId);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchSleepHistory error:", err);
  }
  return [];
}

/**
 * Preserved for backwards compatibility, no-op to protect actual sleep records.
 */
export async function purgeOldSleepLogsExceptYesterday(userId?: string): Promise<void> {
  // No-op: Sleep history must be preserved permanently in the database
  return;
}

export {
  isNapTitle,
  isSleepTitle,
  isSleepOrNapTitle,
  extractTimesFromTitle,
  syncTaskWithSleepLog,
  removeTaskFromSleepLog,
  syncTaskWithSleepNaps,
  removeTaskFromSleepNaps,
} from "./taskSleepSync";


