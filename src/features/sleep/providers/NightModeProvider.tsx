"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getTodayDateString } from "@/lib/dates";
import {
  getStoredSleepLog,
  fetchDbSleepLog,
  saveStoredSleepLog,
  applySleepStartNow,
  applySleepEndNow,
} from "../actions";
import {
  isCurrentlyInSleepWindow,
  isNightModeDismissedUntilBedtime,
  dismissNightModeUntilNextBedtime,
  isNightModeUnlockedForSession,
  setNightModeUnlockedForSession,
  clearNightModeSessionUnlock,
  getSleepingStartTime,
  setSleepingStartTime,
  isNightModeFeatureEnabled,
  setNightModeFeatureEnabled,
  isNightModeInactivityAutoLockEnabled,
  setNightModeInactivityAutoLockEnabled,
  getNightModeInactivityTimeoutMs,
} from "../nightModeUtils";
import { NightModeOverlay } from "../components/NightModeOverlay";
import { LiveActivityBridge } from "@/lib/native/liveActivity";

interface NightModeContextValue {
  isNightModeActive: boolean;
  isSleeping: boolean;
  bedtime: string;
  wakeTime: string;
  isFeatureEnabled: boolean;
  isAutoLockEnabled: boolean;
  toggleFeatureEnabled: (enabled: boolean) => void;
  toggleAutoLockEnabled: (enabled: boolean) => void;
  triggerSleepNow: () => void;
  triggerWakeUp: () => void;
  unlockTasksSession: () => void;
  openTestNightMode: () => void;
  closeTestNightMode: () => void;
  checkNightModeStatus: () => void;
}

const NightModeContext = createContext<NightModeContextValue | null>(null);

export const useNightMode = () => {
  const ctx = useContext(NightModeContext);
  if (!ctx) {
    throw new Error("useNightMode must be used within a NightModeProvider");
  }
  return ctx;
};

export const NightModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bedtime, setBedtime] = useState<string>("23:00");
  const [wakeTime, setWakeTime] = useState<string>("07:00");
  const [isNightModeActive, setIsNightModeActive] = useState<boolean>(false);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [sleepingStartedAt, setSleepingStartedAt] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);

  // User preference toggles
  const [isFeatureEnabled, setIsFeatureEnabled] = useState<boolean>(() => isNightModeFeatureEnabled());
  const [isAutoLockEnabled, setIsAutoLockEnabled] = useState<boolean>(() => isNightModeInactivityAutoLockEnabled());

  const lastActivityRef = useRef<number>(Date.now());
  const todayStr = getTodayDateString();

  // 1. Load initial sleep log and bedtime/wakeTime
  const refreshSleepLog = useCallback(() => {
    const log = getStoredSleepLog(todayStr);
    const bt = log.bedtime || "23:00";
    const wt = log.wakeTime || "07:00";
    setBedtime(bt);
    setWakeTime(wt);

    const storedSleepingStart = getSleepingStartTime();
    if (storedSleepingStart) {
      setIsSleeping(true);
      setSleepingStartedAt(storedSleepingStart);
    }

    return { bedtime: bt, wakeTime: wt, log };
  }, [todayStr]);

  // 2. Check if night mode should be active
  const checkNightModeStatus = useCallback(() => {
    if (isTestMode) {
      setIsNightModeActive(true);
      return;
    }

    // If disabled in settings, never show overlay
    if (!isNightModeFeatureEnabled()) {
      setIsNightModeActive(false);
      return;
    }

    const { bedtime: bt, wakeTime: wt } = refreshSleepLog();
    const now = new Date();

    const inWindow = isCurrentlyInSleepWindow(now, bt, wt);
    const dismissedUntilBedtime = isNightModeDismissedUntilBedtime(now);
    const sessionUnlocked = isNightModeUnlockedForSession();

    if (inWindow && !dismissedUntilBedtime && !sessionUnlocked) {
      setIsNightModeActive(true);
    } else {
      setIsNightModeActive(false);
    }
  }, [isTestMode, refreshSleepLog]);

  // Preference change listener
  useEffect(() => {
    const handlePrefsChange = () => {
      setIsFeatureEnabled(isNightModeFeatureEnabled());
      setIsAutoLockEnabled(isNightModeInactivityAutoLockEnabled());
      checkNightModeStatus();
    };

    window.addEventListener("mytrack:night-mode-prefs-changed", handlePrefsChange);
    return () => window.removeEventListener("mytrack:night-mode-prefs-changed", handlePrefsChange);
  }, [checkNightModeStatus]);

  // Activity tracking for auto-lock on 1-minute inactivity
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("pointerdown", handleUserActivity, { passive: true });
    window.addEventListener("mousemove", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity, { passive: true });
    window.addEventListener("touchstart", handleUserActivity, { passive: true });
    window.addEventListener("scroll", handleUserActivity, { passive: true });

    // Inactivity check timer (every 2 seconds)
    const inactivityTimer = setInterval(() => {
      if (!isNightModeFeatureEnabled() || !isNightModeInactivityAutoLockEnabled()) {
        return;
      }

      // Check if session was unlocked
      const sessionUnlocked = isNightModeUnlockedForSession();
      if (!sessionUnlocked) return;

      const now = new Date();
      const inSleepWindow = isCurrentlyInSleepWindow(now, bedtime, wakeTime);
      const dismissed = isNightModeDismissedUntilBedtime(now);

      if (inSleepWindow && !dismissed) {
        const timeoutMs = getNightModeInactivityTimeoutMs();
        const inactiveDuration = Date.now() - lastActivityRef.current;

        if (inactiveDuration >= timeoutMs) {
          // Re-lock session and restore Night Mode screen!
          clearNightModeSessionUnlock();
          setIsNightModeActive(true);
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener("pointerdown", handleUserActivity);
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      clearInterval(inactivityTimer);
    };
  }, [bedtime, wakeTime]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial check
    refreshSleepLog();
    fetchDbSleepLog(todayStr).then((remote) => {
      if (remote) {
        if (remote.bedtime) setBedtime(remote.bedtime);
        if (remote.wakeTime) setWakeTime(remote.wakeTime);
      }
      checkNightModeStatus();
    });

    // Check periodically every 15 seconds
    const interval = setInterval(() => {
      checkNightModeStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, [todayStr, refreshSleepLog, checkNightModeStatus]);

  // Handler: "Je me couche maintenant"
  const triggerSleepNow = () => {
    const log = getStoredSleepLog(todayStr);
    const updated = applySleepStartNow(log);
    saveStoredSleepLog(updated);

    const nowIso = new Date().toISOString();
    setSleepingStartTime(nowIso);
    setIsSleeping(true);
    setSleepingStartedAt(nowIso);
    if (updated.bedtime) setBedtime(updated.bedtime);

    // Synchroniser immédiatement la Live Activity et le Widget
    LiveActivityBridge.syncSleepMode({
      isActive: true,
      bedtime: updated.bedtime || bedtime || "23:00",
      phaseIndex: 1,
      isSecondSleep: false,
      startedAtTimestamp: Date.now() / 1000,
    });
  };

  // Handler: "Je me réveille"
  const triggerWakeUp = () => {
    const log = getStoredSleepLog(todayStr);
    const updated = applySleepEndNow(log);
    saveStoredSleepLog(updated);

    setSleepingStartTime(null);
    setIsSleeping(false);
    setSleepingStartedAt(null);

    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem("mytrack_last_wake_iso", nowIso);
    } catch {}

    // Synchroniser immédiatement l'arrêt avec la Live Activity et le Widget
    LiveActivityBridge.syncSleepMode({
      isActive: false,
      bedtime: updated.bedtime || bedtime || "23:00",
      wakeTime: updated.wakeTime,
      isSecondSleep: false,
      startedAtTimestamp: Date.now() / 1000,
    });

    // Dismiss until the next bedtime
    dismissNightModeUntilNextBedtime(bedtime);
    setIsTestMode(false);
    setIsNightModeActive(false);
  };

  // Handler: "Je veux voir mes tâches" (5-second hold unlocked)
  const unlockTasksSession = () => {
    lastActivityRef.current = Date.now();
    setNightModeUnlockedForSession();
    setIsTestMode(false);
    setIsNightModeActive(false);
  };

  const toggleFeatureEnabled = (enabled: boolean) => {
    setNightModeFeatureEnabled(enabled);
    setIsFeatureEnabled(enabled);
    if (!enabled) {
      setIsNightModeActive(false);
    } else {
      checkNightModeStatus();
    }
  };

  const toggleAutoLockEnabled = (enabled: boolean) => {
    setNightModeInactivityAutoLockEnabled(enabled);
    setIsAutoLockEnabled(enabled);
  };

  // Test mode helpers (for manual previewing in app)
  const openTestNightMode = () => {
    setIsTestMode(true);
    setIsNightModeActive(true);
  };

  const closeTestNightMode = () => {
    setIsTestMode(false);
    setIsNightModeActive(false);
  };

  return (
    <NightModeContext.Provider
      value={{
        isNightModeActive,
        isSleeping,
        bedtime,
        wakeTime,
        isFeatureEnabled,
        isAutoLockEnabled,
        toggleFeatureEnabled,
        toggleAutoLockEnabled,
        triggerSleepNow,
        triggerWakeUp,
        unlockTasksSession,
        openTestNightMode,
        closeTestNightMode,
        checkNightModeStatus,
      }}
    >
      {children}

      {/* Render Night Mode Fullscreen Overlay when active */}
      {isNightModeActive && (
        <NightModeOverlay
          bedtime={bedtime}
          wakeTime={wakeTime}
          isSleeping={isSleeping}
          sleepingStartedAt={sleepingStartedAt}
          onSleepNow={triggerSleepNow}
          onWakeUp={triggerWakeUp}
          onUnlockTasks={unlockTasksSession}
          onCloseTest={closeTestNightMode}
          isTestMode={isTestMode}
        />
      )}
    </NightModeContext.Provider>
  );
};
