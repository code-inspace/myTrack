import { format, parseISO, differenceInMinutes, subDays } from "date-fns";
import { getStoredSleepLog, saveStoredSleepLog } from "./actions";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export const STORAGE_KEY_LAST_CLOSED = "mytrack_last_app_closed_iso";
export const STORAGE_KEY_LAST_OPENED = "mytrack_last_app_opened_iso";
export const STORAGE_KEY_LAST_AUTO_DETECTED_DATE = "mytrack_last_auto_sleep_date";

export interface AutoSleepDetectionResult {
  detected: boolean;
  bedtime?: string;
  wakeTime?: string;
  bedtimeDate?: string;
  wakeDate?: string;
  durationMinutes?: number;
  reason?: string;
}

/**
 * Heuristics configuration for night sleep detection:
 * - Night window (evening / late night): 20:00 to 05:00
 * - Morning window (wake up): 05:00 to 13:00
 * - Min sleep duration: 180 min (3h)
 * - Max sleep duration: 960 min (16h)
 */
export const SLEEP_CONFIG = {
  NIGHT_START_HOUR: 20, // 20h00
  NIGHT_END_HOUR: 5,   // 05h00
  MORNING_START_HOUR: 5, // 05h00
  MORNING_END_HOUR: 13,  // 13h00
  MIN_SLEEP_MINUTES: 180, // 3 hours
  MAX_SLEEP_MINUTES: 960, // 16 hours
};

export function isNightHour(hour: number): boolean {
  return hour >= SLEEP_CONFIG.NIGHT_START_HOUR || hour < SLEEP_CONFIG.NIGHT_END_HOUR;
}

export function isMorningHour(hour: number): boolean {
  return hour >= SLEEP_CONFIG.MORNING_START_HOUR && hour < SLEEP_CONFIG.MORNING_END_HOUR;
}

/**
 * Records when the app goes into the background or closes.
 * If within the night window, candidate bedtime is updated.
 */
export function recordAppBackground(now: Date = new Date()): void {
  if (typeof window === "undefined") return;

  const nowIso = now.toISOString();
  try {
    localStorage.setItem(STORAGE_KEY_LAST_CLOSED, nowIso);
  } catch (e) {
    console.warn("[AutoSleepTracker] Failed to persist last closed:", e);
  }

  const hour = now.getHours();
  if (isNightHour(hour)) {
    const timeStr = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dateStr = hour >= SLEEP_CONFIG.NIGHT_START_HOUR
      ? format(now, "yyyy-MM-dd")
      : format(subDays(now, 1), "yyyy-MM-dd");

    const currentLog = getStoredSleepLog(dateStr);
    // Only update if not explicitly validated by user
    if (!currentLog.bedtimeValidated) {
      const updatedLog = {
        ...currentLog,
        bedtime: timeStr,
      };
      saveStoredSleepLog(updatedLog);
      console.log(`[AutoSleepTracker] Candidate bedtime set to ${timeStr} for night of ${dateStr}`);
    }
  }
}

/**
 * Checks and detects sleep when the app becomes active/foreground in the morning.
 */
export function processAppForeground(now: Date = new Date()): AutoSleepDetectionResult {
  if (typeof window === "undefined") {
    return { detected: false, reason: "Server environment" };
  }

  const nowIso = now.toISOString();
  try {
    localStorage.setItem(STORAGE_KEY_LAST_OPENED, nowIso);
  } catch {}

  const currentHour = now.getHours();
  const todayStr = format(now, "yyyy-MM-dd");

  // Check if we are in the morning window
  if (!isMorningHour(currentHour)) {
    return { detected: false, reason: "Not in morning window (05:00 - 13:00)" };
  }

  // Get last recorded app close
  const lastClosedIso = localStorage.getItem(STORAGE_KEY_LAST_CLOSED);
  if (!lastClosedIso) {
    return { detected: false, reason: "No previous app close timestamp found" };
  }

  try {
    const closedDate = parseISO(lastClosedIso);
    const minutesDiff = differenceInMinutes(now, closedDate);

    // Validate duration range (e.g. between 3h and 16h)
    if (minutesDiff < SLEEP_CONFIG.MIN_SLEEP_MINUTES) {
      return {
        detected: false,
        reason: `Duration too short (${minutesDiff} min < ${SLEEP_CONFIG.MIN_SLEEP_MINUTES} min)`,
      };
    }

    if (minutesDiff > SLEEP_CONFIG.MAX_SLEEP_MINUTES) {
      return {
        detected: false,
        reason: `Duration too long (${minutesDiff} min > ${SLEEP_CONFIG.MAX_SLEEP_MINUTES} min)`,
      };
    }

    const closedHour = closedDate.getHours();
    if (!isNightHour(closedHour)) {
      return {
        detected: false,
        reason: `Previous app close was not during night window (was at ${closedHour}h)`,
      };
    }

    // Determine the bedtime date (eve of wakeDate)
    const bedtimeDateStr = closedHour >= SLEEP_CONFIG.NIGHT_START_HOUR
      ? format(closedDate, "yyyy-MM-dd")
      : format(subDays(closedDate, 1), "yyyy-MM-dd");

    const bedtimeStr = `${String(closedHour).padStart(2, "0")}:${String(closedDate.getMinutes()).padStart(2, "0")}`;
    const wakeTimeStr = `${String(currentHour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Update yesterday's bedtime if not manually locked
    const yesterdayLog = getStoredSleepLog(bedtimeDateStr);
    if (!yesterdayLog.bedtimeValidated) {
      saveStoredSleepLog({
        ...yesterdayLog,
        bedtime: bedtimeStr,
      });
    }

    // Update today's wake time if not manually locked
    const todayLog = getStoredSleepLog(todayStr);
    if (!todayLog.wakeTimeValidated) {
      saveStoredSleepLog({
        ...todayLog,
        wakeTime: wakeTimeStr,
      });
    }

    localStorage.setItem(STORAGE_KEY_LAST_AUTO_DETECTED_DATE, todayStr);

    // Dispatch custom event for UI components to re-render
    window.dispatchEvent(
      new CustomEvent("mytrack:sleep-auto-detected", {
        detail: {
          bedtime: bedtimeStr,
          wakeTime: wakeTimeStr,
          bedtimeDate: bedtimeDateStr,
          wakeDate: todayStr,
          durationMinutes: minutesDiff,
        },
      })
    );

    console.log(
      `[AutoSleepTracker] Sleep detected: Bedtime ${bedtimeStr} (${bedtimeDateStr}) -> WakeTime ${wakeTimeStr} (${todayStr}), Duration: ${Math.floor(minutesDiff / 60)}h${minutesDiff % 60}m`
    );

    return {
      detected: true,
      bedtime: bedtimeStr,
      wakeTime: wakeTimeStr,
      bedtimeDate: bedtimeDateStr,
      wakeDate: todayStr,
      durationMinutes: minutesDiff,
    };
  } catch (err) {
    console.warn("[AutoSleepTracker] Error processing app foreground:", err);
    return { detected: false, reason: String(err) };
  }
}

/**
 * Initializes automatic lifecycle listeners for iOS Capacitor and Web browser.
 */
export function initAutoSleepTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  // Process foreground immediately on app boot
  processAppForeground(new Date());

  // 1. Capacitor Native App State Listener
  let capStateHandle: any = null;
  if (Capacitor.isPluginAvailable("App")) {
    CapApp.addListener("appStateChange", ({ isActive }) => {
      const now = new Date();
      if (isActive) {
        processAppForeground(now);
      } else {
        recordAppBackground(now);
      }
    }).then((handle) => {
      capStateHandle = handle;
    }).catch(() => {});
  }

  // 2. Web visibility and window lifecycle events
  const onVisibilityChange = () => {
    const now = new Date();
    if (document.visibilityState === "visible") {
      processAppForeground(now);
    } else if (document.visibilityState === "hidden") {
      recordAppBackground(now);
    }
  };

  const onPageHideOrBeforeUnload = () => {
    recordAppBackground(new Date());
  };

  const onWindowFocus = () => {
    processAppForeground(new Date());
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHideOrBeforeUnload);
  window.addEventListener("beforeunload", onPageHideOrBeforeUnload);
  window.addEventListener("focus", onWindowFocus);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHideOrBeforeUnload);
    window.removeEventListener("beforeunload", onPageHideOrBeforeUnload);
    window.removeEventListener("focus", onWindowFocus);
    if (capStateHandle && typeof capStateHandle.remove === "function") {
      capStateHandle.remove();
    }
  };
}
