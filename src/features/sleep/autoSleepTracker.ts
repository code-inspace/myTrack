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
 * Configuration for sleep detection based on app absence duration:
 * - Main sleep (Dodo): absence between 180 min (3h) and 1080 min (18h)
 * - Nap (Sieste): absence between 20 min and 179 min
 * - Short interruption: < 20 min
 */
export const SLEEP_CONFIG = {
  MIN_SLEEP_MINUTES: 180, // 3 hours
  MAX_SLEEP_MINUTES: 1080, // 18 hours
};

import { LiveActivityBridge } from "@/lib/native/liveActivity";

/**
 * Records when the app goes into the background or is closed.
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
  // ONLY set candidate bedtime if closed during the nighttime window (>= 23:00 or < 12:00)
  // Closing the app during daytime (12:00 - 22:59) is daytime phone usage
  if (hour < 23 && hour >= 12) {
    return;
  }

  const timeStr = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const dateStr = hour < 12
    ? format(subDays(now, 1), "yyyy-MM-dd")
    : format(now, "yyyy-MM-dd");
  const todayStr = format(now, "yyyy-MM-dd");

  try {
    const todayLog = getStoredSleepLog(todayStr);
    const lastWakeIso = localStorage.getItem("mytrack_last_wake_iso");
    const lastWakeDate = lastWakeIso ? parseISO(lastWakeIso) : null;
    const minutesSinceWake = lastWakeDate ? differenceInMinutes(now, lastWakeDate) : null;

    // Vérifier si l'utilisateur a annulé le 2ème sommeil ("Je ne dors pas") récemment (< 8 heures)
    const canceledTsRaw = localStorage.getItem("mytrack_sleep_canceled_second_sleep_ts");
    const canceledTs = canceledTsRaw ? parseFloat(canceledTsRaw) : 0;
    const isRecentlyCanceled = canceledTs > 0 && (now.getTime() / 1000 - canceledTs < 8 * 3600);

    // Si l'utilisateur s'est réveillé aujourd'hui :
    // On ne redéclenche le mode sommeil QUE SI l'inactivité dépasse 60 minutes (1 heure) et qu'il n'a pas annulé
    if (todayLog.wakeTime || lastWakeDate) {
      if (isRecentlyCanceled) {
        console.log("[AutoSleepTracker] 2nd sleep canceled recently by user ('Je ne dors pas') -> Keep normal mode.");
        return;
      }

      if (minutesSinceWake !== null && minutesSinceWake < 60) {
        console.log(`[AutoSleepTracker] App backgrounded ${minutesSinceWake}min after wake (< 60min) -> Keep normal mode.`);
        return;
      }

      // Si inactivité >= 60 minutes en matinée (< 12h) et non annulé : 2ème phase de sommeil
      if (hour < 12) {
        console.log(`[AutoSleepTracker] 1h+ inactivity post-wake detected -> Triggering 2nd sleep mode (phase 2) with "Je ne dors pas" option.`);
        LiveActivityBridge.syncSleepMode({
          isActive: true,
          bedtime: timeStr,
          phaseIndex: 2,
          isSecondSleep: true,
          startedAtTimestamp: now.getTime() / 1000,
        });
        return;
      }
    }

    // Premier sommeil standard
    const currentLog = getStoredSleepLog(dateStr);
    if (!currentLog.bedtimeValidated) {
      saveStoredSleepLog({
        ...currentLog,
        bedtime: timeStr,
      });
      console.log(`[AutoSleepTracker] Candidate bedtime set to ${timeStr} for night of ${dateStr}`);
    }

    // Synchroniser avec la Live Activity & le Widget natif
    LiveActivityBridge.syncSleepMode({
      isActive: true,
      bedtime: timeStr,
      phaseIndex: 1,
      isSecondSleep: false,
      startedAtTimestamp: now.getTime() / 1000,
    });
  } catch {}
}

/**
 * Detects sleep sessions based primarily on the duration of absence from the app.
 */
export function processAppForeground(now: Date = new Date()): AutoSleepDetectionResult {
  if (typeof window === "undefined") {
    return { detected: false, reason: "Server environment" };
  }

  const nowIso = now.toISOString();
  try {
    localStorage.setItem(STORAGE_KEY_LAST_OPENED, nowIso);
  } catch {}

  const todayStr = format(now, "yyyy-MM-dd");

  // Get last recorded app close timestamp
  const lastClosedIso = localStorage.getItem(STORAGE_KEY_LAST_CLOSED);
  if (!lastClosedIso) {
    return { detected: false, reason: "No previous app close timestamp found" };
  }

  try {
    const closedDate = parseISO(lastClosedIso);
    const minutesDiff = differenceInMinutes(now, closedDate);

    // 1. MAIN SLEEP DETECTION (Absence between 3h and 18h during 23h-12h window)
    if (minutesDiff >= SLEEP_CONFIG.MIN_SLEEP_MINUTES && minutesDiff <= SLEEP_CONFIG.MAX_SLEEP_MINUTES) {
      const closedHour = closedDate.getHours();
      const openHour = now.getHours();

      // Only count as overnight sleep if it started during evening/night (>= 20h or < 6h) or morning wake (< 14h)
      const isNightSleep = closedHour >= 20 || closedHour < 6 || (closedHour < 12 && openHour <= 12);
      if (!isNightSleep) {
        return {
          detected: false,
          reason: `Daytime absence (${closedHour}h -> ${openHour}h) is not overnight sleep`,
        };
      }

      const bedtimeDateStr = closedHour < 12
        ? format(subDays(closedDate, 1), "yyyy-MM-dd")
        : format(closedDate, "yyyy-MM-dd");

      const bedtimeStr = `${String(closedHour).padStart(2, "0")}:${String(closedDate.getMinutes()).padStart(2, "0")}`;
      const wakeTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      // Update bedtime on the eve/sleep start date if not manually validated
      const yesterdayLog = getStoredSleepLog(bedtimeDateStr);
      if (!yesterdayLog.bedtimeValidated) {
        saveStoredSleepLog({
          ...yesterdayLog,
          bedtime: bedtimeStr,
        });
      }

      // Update wake time on today's date if not manually validated
      const todayLog = getStoredSleepLog(todayStr);
      if (!todayLog.wakeTimeValidated) {
        saveStoredSleepLog({
          ...todayLog,
          wakeTime: wakeTimeStr,
        });
      }

      localStorage.setItem(STORAGE_KEY_LAST_AUTO_DETECTED_DATE, todayStr);

      window.dispatchEvent(
        new CustomEvent("mytrack:sleep-auto-detected", {
          detail: {
            bedtime: bedtimeStr,
            wakeTime: wakeTimeStr,
            bedtimeDate: bedtimeDateStr,
            wakeDate: todayStr,
            durationMinutes: minutesDiff,
            type: "night",
          },
        })
      );

      // Synchroniser l'état réveillé avec les Live Activities
      LiveActivityBridge.syncSleepMode({
        isActive: false,
        bedtime: bedtimeStr,
        wakeTime: wakeTimeStr,
        startedAtTimestamp: now.getTime() / 1000,
      });

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
    }

    // 2. Short absence (< 3h)
    if (minutesDiff < SLEEP_CONFIG.MIN_SLEEP_MINUTES) {
      return {
        detected: false,
        reason: `Duration too short for overnight sleep (${minutesDiff} min < ${SLEEP_CONFIG.MIN_SLEEP_MINUTES} min)`,
      };
    }

    return {
      detected: false,
      reason: `Duration exceeds maximum limit (${minutesDiff} min > ${SLEEP_CONFIG.MAX_SLEEP_MINUTES} min)`,
    };
  } catch (err) {
    console.warn("[AutoSleepTracker] Error processing app foreground:", err);
    return { detected: false, reason: String(err) };
  }
}

/**
 * Removes any legacy auto-detected nap entries created by earlier versions
 * (retains user-created task naps and manual quick action naps).
 */
export function scrubAutoGeneratedNaps(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToClean: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("mytrack_sleeplog_")) {
        keysToClean.push(key);
      }
    }

    for (const key of keysToClean) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.naps) && parsed.naps.length > 0) {
            const cleaned = parsed.naps.filter(
              (n: any) => Boolean(n.taskId) || (typeof n.id === "string" && n.id.startsWith("nap_"))
            );
            if (cleaned.length !== parsed.naps.length) {
              parsed.naps = cleaned;
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          }
        }
      } catch {}
    }
  } catch (e) {
    console.warn("[AutoSleepTracker] scrubAutoGeneratedNaps error:", e);
  }
}

/**
 * Initializes automatic lifecycle listeners for iOS Capacitor and Web browser.
 */
export function initAutoSleepTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  // Clean any legacy auto-generated naps on launch
  scrubAutoGeneratedNaps();

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
