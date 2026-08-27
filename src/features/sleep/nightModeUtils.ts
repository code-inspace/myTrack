import { DailySleepLog } from "./types";
import { getStoredSleepLog } from "./actions";
import { getTodayDateString } from "@/lib/dates";
import { format, parseISO, addDays } from "date-fns";

const NIGHT_MODE_DISMISSED_KEY = "mytrack_night_mode_dismissed_until";
const NIGHT_MODE_SESSION_UNLOCKED_KEY = "mytrack_night_mode_session_unlocked";
const NIGHT_MODE_SLEEPING_START_KEY = "mytrack_night_mode_sleeping_start";

/**
 * Checks if the current time falls inside the user's programmed sleep window.
 * Default bedtime: 23:00, default wakeTime: 07:00.
 */
export function isCurrentlyInSleepWindow(
  now: Date = new Date(),
  bedtimeStr?: string | null,
  wakeTimeStr?: string | null,
): boolean {
  const bedtime = bedtimeStr || "23:00";
  const wakeTime = wakeTimeStr || "07:00";

  const [bH, bM] = bedtime.split(":").map((v) => parseInt(v, 10) || 0);
  const [wH, wM] = wakeTime.split(":").map((v) => parseInt(v, 10) || 0);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const bedMinutes = bH * 60 + bM;
  const wakeMinutes = wH * 60 + wM;

  if (bedMinutes <= wakeMinutes) {
    // Bedtime and wakeTime within the same calendar day (e.g. 01:00 to 08:00)
    return currentMinutes >= bedMinutes && currentMinutes < wakeMinutes;
  } else {
    // Standard night schedule crossing midnight (e.g. 22:30 to 07:15)
    return currentMinutes >= bedMinutes || currentMinutes < wakeMinutes;
  }
}

/**
 * Calculates the next bedtime timestamp (ISO string) when the user wakes up.
 * If user wakes up in the morning (e.g. 07:00), next bedtime is today at bedtime (e.g. 22:30).
 * If user wakes up after bedtime (e.g. 23:45), next bedtime is tomorrow at bedtime.
 */
export function getNextBedtimeIso(bedtimeStr?: string | null, now: Date = new Date()): string {
  const bedtime = bedtimeStr || "23:00";
  const [bH, bM] = bedtime.split(":").map((v) => parseInt(v, 10) || 0);

  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bH, bM, 0);

  if (now.getTime() >= targetDate.getTime()) {
    // Today's bedtime already passed (e.g. waking up at 23:45), next bedtime is tomorrow
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate.toISOString();
}

/**
 * Checks if night mode is currently dismissed by "Je me réveille".
 */
export function isNightModeDismissedUntilBedtime(now: Date = new Date()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(NIGHT_MODE_DISMISSED_KEY);
    if (!raw) return false;
    const dismissedUntil = new Date(raw);
    if (isNaN(dismissedUntil.getTime())) return false;
    return now.getTime() < dismissedUntil.getTime();
  } catch {
    return false;
  }
}

/**
 * Marks night mode as dismissed until the next programmed bedtime.
 */
export function dismissNightModeUntilNextBedtime(bedtimeStr?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const nextBedtimeIso = getNextBedtimeIso(bedtimeStr);
    localStorage.setItem(NIGHT_MODE_DISMISSED_KEY, nextBedtimeIso);
  } catch (err) {
    console.warn("dismissNightModeUntilNextBedtime error:", err);
  }
}

/**
 * Checks if night mode was unlocked for the current app session via the 5-second hold on "Je veux voir mes tâches".
 */
export function isNightModeUnlockedForSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(NIGHT_MODE_SESSION_UNLOCKED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Sets night mode unlocked for the current app session.
 */
export function setNightModeUnlockedForSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NIGHT_MODE_SESSION_UNLOCKED_KEY, "true");
  } catch (err) {
    console.warn("setNightModeUnlockedForSession error:", err);
  }
}

/**
 * Clears the session unlock (e.g. for testing).
 */
export function clearNightModeSessionUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(NIGHT_MODE_SESSION_UNLOCKED_KEY);
  } catch {}
}

/**
 * Get sleeping start timestamp if user clicked "Je me couche maintenant".
 */
export function getSleepingStartTime(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NIGHT_MODE_SLEEPING_START_KEY);
}

export function setSleepingStartTime(isoStr: string | null): void {
  if (typeof window === "undefined") return;
  if (isoStr) {
    localStorage.setItem(NIGHT_MODE_SLEEPING_START_KEY, isoStr);
  } else {
    localStorage.removeItem(NIGHT_MODE_SLEEPING_START_KEY);
  }
}
