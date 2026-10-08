import { DailySleepLog, NapSession } from "./types";
import { isNightSleepTime, isAfterMidnightBedtime, isEveningBedtimeHour } from "./sleepRules";
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
const SLEEP_TARGET_PREFIX = "mytrack_sleep_target_";

export interface SleepTargetConfig {
  targetBedtime: string; // e.g. "23:00"
  targetWakeTime: string; // e.g. "07:00"
}

export function getStoredSleepTarget(userId?: string): SleepTargetConfig {
  const targetId = getEffectiveUserId(userId);
  if (typeof window === "undefined") {
    return { targetBedtime: "23:00", targetWakeTime: "07:00" };
  }
  try {
    const raw = (targetId && localStorage.getItem(`${SLEEP_TARGET_PREFIX}${targetId}`)) || localStorage.getItem(SLEEP_TARGET_PREFIX);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.targetBedtime && parsed.targetWakeTime) {
        return parsed;
      }
    }
  } catch {}
  return { targetBedtime: "23:00", targetWakeTime: "07:00" };
}

export function saveStoredSleepTarget(target: SleepTargetConfig, userId?: string): void {
  const targetId = getEffectiveUserId(userId);
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(target);
    if (targetId) {
      localStorage.setItem(`${SLEEP_TARGET_PREFIX}${targetId}`, json);
    }
    localStorage.setItem(SLEEP_TARGET_PREFIX, json);
    window.dispatchEvent(new CustomEvent("mytrack:sleep-auto-detected"));
  } catch (err) {
    console.warn("saveStoredSleepTarget error:", err);
  }
}

/**
 * The sleep objective the user set themselves (agenda "Objectif sommeil"), or null. Unlike
 * getStoredSleepTarget (which falls back to 23:00 → 07:00 to prefill forms), nothing is shown
 * as an objective unless this returns a value. Old versions saved a target automatically when a
 * night was edited, so only this dedicated key counts as a user choice.
 */
const USER_SLEEP_OBJECTIVE_KEY = "mytrack_sleep_objective_v2_";
const SLEEP_OBJECTIVE_METADATA_KEY = "sleepObjective";

function isValidObjective(value: unknown): value is SleepTargetConfig {
  const v = value as SleepTargetConfig | null;
  return Boolean(v && /^\d{2}:\d{2}$/.test(v.targetBedtime) && /^\d{2}:\d{2}$/.test(v.targetWakeTime));
}

export function getUserSleepObjective(userId?: string): SleepTargetConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${USER_SLEEP_OBJECTIVE_KEY}${getEffectiveUserId(userId)}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return isValidObjective(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cacheUserSleepObjective(objective: SleepTargetConfig | null, userId?: string) {
  try {
    const key = `${USER_SLEEP_OBJECTIVE_KEY}${getEffectiveUserId(userId)}`;
    if (objective) localStorage.setItem(key, JSON.stringify(objective));
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable: the account copy still holds it
  }
}

/** Sets (or clears with null) the user's sleep objective, on this device and on the account. */
export async function setUserSleepObjective(objective: SleepTargetConfig | null, userId?: string): Promise<void> {
  cacheUserSleepObjective(objective, userId);
  if (objective) saveStoredSleepTarget(objective, userId);
  try {
    window.dispatchEvent(new CustomEvent("mytrack:sleep-auto-detected"));
  } catch {}
  try {
    await createClient().auth.updateUser({ data: { [SLEEP_OBJECTIVE_METADATA_KEY]: objective } });
  } catch (err) {
    console.warn("setUserSleepObjective account sync note:", err);
  }
}

/** Pulls the objective saved on the account (set from another device) into this device. */
export async function syncUserSleepObjectiveFromAccount(userId?: string): Promise<void> {
  try {
    const { data } = await createClient().auth.getUser();
    const metadata = data?.user?.user_metadata;
    if (!metadata || !(SLEEP_OBJECTIVE_METADATA_KEY in metadata)) return;
    const remote = metadata[SLEEP_OBJECTIVE_METADATA_KEY];
    const next = isValidObjective(remote) ? remote : null;
    const current = getUserSleepObjective(userId);
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      cacheUserSleepObjective(next, userId);
      if (next) saveStoredSleepTarget(next, userId);
      window.dispatchEvent(new CustomEvent("mytrack:sleep-auto-detected"));
    }
  } catch {
    // offline: keep the local copy
  }
}

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
  // Sanity check: single sleep session cannot exceed 18 hours or be negative/zero
  if (diff <= 0 || diff > 18 * 60) {
    return null;
  }

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
 * A "coucher"/"réveil" quick action pressed in the night window (see sleepRules) is assumed to be
 * the main night's sleep; outside that window it's assumed to be a daytime nap.
 */
function isNightWindow(timeStr: string): boolean {
  return isNightSleepTime(timeStr);
}

/**
 * Calculates the sleep log date to which bedtime belongs.
 * If bedtime is in early morning (00:00 to 06:59), it belongs to the night that started
 * the previous evening (date - 1 day).
 * Otherwise (e.g. 18:00 to 23:59), it belongs to the given calendar date.
 */
export function getEffectiveBedDate(timeStr: string, baseDateStr?: string): string {
  const base = baseDateStr ? parseISO(baseDateStr) : new Date();
  if (isAfterMidnightBedtime(timeStr)) {
    return format(subDays(base, 1), "yyyy-MM-dd");
  }
  return format(base, "yyyy-MM-dd");
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

/**
 * Records bedtime at the current moment, ensuring late bedtimes (00:00 - 06:59) are
 * attributed to the sleep cycle that started the previous evening (date - 1 day).
 */
export async function recordBedtimeNow(userId?: string): Promise<{ log: DailySleepLog; bedDate: string }> {
  const now = new Date();
  const nowTime = currentLocalTimeStr();
  const todayStr = format(now, "yyyy-MM-dd");
  const bedDate = getEffectiveBedDate(nowTime, todayStr);

  const log = getStoredSleepLog(bedDate, userId);
  const updated = applySleepStartNow(log);
  updated.date = bedDate;
  await saveStoredSleepLog(updated, userId);
  return { log: updated, bedDate };
}

/**
 * Records wake-up time at the current moment, attributing to today's morning.
 */
export async function recordWakeUpNow(userId?: string): Promise<{ log: DailySleepLog; wakeDate: string }> {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const log = getStoredSleepLog(todayStr, userId);
  const updated = applySleepEndNow(log);
  updated.date = todayStr;
  await saveStoredSleepLog(updated, userId);
  return { log: updated, wakeDate: todayStr };
}

function mapDbSleepLogToModel(row: any): DailySleepLog {
  // Missing times fall back to the user's sleep target (as unvalidated placeholders), like local logs.
  const target = getStoredSleepTarget(row.user_id);
  const localBedtime = row.bedtime ? convertUtcTimeToLocal(row.bedtime, row.date) : target.targetBedtime;
  const localWakeTime = row.wake_time ? convertUtcTimeToLocal(row.wake_time, row.date) : target.targetWakeTime;

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
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Future dates NEVER have validated recorded sleep; they only return unvalidated target goals
  if (date > todayStr) {
    const target = getStoredSleepTarget(userId);
    return {
      date,
      bedtime: target.targetBedtime,
      wakeTime: target.targetWakeTime,
      bedtimeValidated: false,
      wakeTimeValidated: false,
      naps: [],
      notes: "",
      gratitude: "",
      manifestation: "",
    };
  }

  const sleepTarget = getStoredSleepTarget(userId);
  if (typeof window === "undefined") {
    return {
      date,
      bedtime: sleepTarget.targetBedtime,
      wakeTime: sleepTarget.targetWakeTime,
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

  // Default initial sleep log: the user's target times, unvalidated
  return {
    date,
    bedtime: sleepTarget.targetBedtime,
    wakeTime: sleepTarget.targetWakeTime,
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
    const todayStr = format(new Date(), "yyyy-MM-dd");
    // Strictly guard against future dates: future days cannot have recorded sleep
    if (wakeDateStr > todayStr) {
      return null;
    }

    const d = parseISO(wakeDateStr);
    const yesterdayStr = format(subDays(d, 1), "yyyy-MM-dd");

    const yesterdayLog = getStoredSleepLog(yesterdayStr, userId);
    const todayLog = getStoredSleepLog(wakeDateStr, userId);

    const yesterdayBedHour = yesterdayLog.bedtime
      ? parseInt(yesterdayLog.bedtime.split(":")[0], 10)
      : null;
    const todayBedHour = todayLog.bedtime
      ? parseInt(todayLog.bedtime.split(":")[0], 10)
      : null;

    const hasYesterdayBedtimeValidated = Boolean(
      yesterdayLog.bedtime && yesterdayLog.bedtimeValidated
    );

    const hasYesterdayEvening = Boolean(
      yesterdayLog.bedtime &&
      yesterdayBedHour !== null &&
      isEveningBedtimeHour(yesterdayBedHour) &&
      (yesterdayLog.bedtimeValidated || yesterdayLog.updatedAt || yesterdayLog.bedtime !== "23:00")
    );

    const hasTodayEarlyBedtimeValidated = Boolean(
      todayLog.bedtime &&
      todayBedHour !== null &&
      todayBedHour < 12 &&
      todayLog.bedtimeValidated
    );

    const hasTodayWakeTime = Boolean(
      todayLog.wakeTime && (todayLog.wakeTimeValidated || todayLog.updatedAt || todayLog.wakeTime !== "07:00")
    );

    if (!hasYesterdayBedtimeValidated && !hasYesterdayEvening && !hasTodayEarlyBedtimeValidated && !hasTodayWakeTime) {
      return null;
    }

    let bedtime = "23:00";
    if (hasYesterdayBedtimeValidated && yesterdayLog.bedtime) {
      bedtime = yesterdayLog.bedtime;
    } else if (hasTodayEarlyBedtimeValidated && todayLog.bedtime) {
      bedtime = todayLog.bedtime;
    } else if (hasYesterdayEvening && yesterdayLog.bedtime) {
      bedtime = yesterdayLog.bedtime;
    } else if (yesterdayLog.bedtime && yesterdayBedHour !== null && isEveningBedtimeHour(yesterdayBedHour)) {
      bedtime = yesterdayLog.bedtime;
    } else if (todayLog.bedtime && todayBedHour !== null && todayBedHour < 12) {
      bedtime = todayLog.bedtime;
    }

    const wakeTime = todayLog.wakeTime || "07:00";
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
 * Purges any accidental or legacy sleep log records with dates in the future.
 * Future dates are strictly target goals, never real recorded sleep.
 */
export async function purgeFutureSleepLogs(userId?: string): Promise<void> {
  const targetId = getEffectiveUserId(userId);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(SLEEP_STORAGE_PREFIX)) {
          const parts = key.split("_");
          const datePart = parts[parts.length - 1];
          if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart) && datePart > todayStr) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }

  const supabase = createClient();
  try {
    let effectiveId = targetId;
    if (!effectiveId) {
      const { data: { session } } = await supabase.auth.getSession();
      effectiveId = session?.user?.id || "";
    }
    if (effectiveId) {
      await supabase
        .from("sleep_logs")
        .delete()
        .eq("user_id", effectiveId)
        .gt("date", todayStr);
    }
  } catch (err) {
    console.warn("purgeFutureSleepLogs error:", err);
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
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Future dates CANNOT have real validated recorded sleep
  if (log.date > todayStr) {
    return {
      ...log,
      bedtimeValidated: false,
      wakeTimeValidated: false,
    };
  }

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
  const todayStr = format(new Date(), "yyyy-MM-dd");

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  // Automatically clean up any future records
  Promise.resolve(purgeFutureSleepLogs(targetId)).catch(() => {});

  try {
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", targetId)
      .lte("date", todayStr)
      .order("date", { ascending: false })
      .limit(days);

    if (!error && data) {
      const validRows = data.filter((row: any) => row.date <= todayStr);
      const mapped = validRows.map(mapDbSleepLogToModel);
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


