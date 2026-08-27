"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  getSleepingStartTime,
  setSleepingStartTime,
} from "../nightModeUtils";
import { NightModeOverlay } from "../components/NightModeOverlay";

interface NightModeContextValue {
  isNightModeActive: boolean;
  isSleeping: boolean;
  bedtime: string;
  wakeTime: string;
  triggerSleepNow: () => void;
  triggerWakeUp: () => void;
  unlockTasksSession: () => void;
  openTestNightMode: () => void;
  closeTestNightMode: () => void;
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
  };

  // Handler: "Je me réveille"
  const triggerWakeUp = () => {
    const log = getStoredSleepLog(todayStr);
    const updated = applySleepEndNow(log);
    saveStoredSleepLog(updated);

    setSleepingStartTime(null);
    setIsSleeping(false);
    setSleepingStartedAt(null);

    // Dismiss until the next bedtime
    dismissNightModeUntilNextBedtime(bedtime);
    setIsTestMode(false);
    setIsNightModeActive(false);
  };

  // Handler: "Je veux voir mes tâches" (5-second hold unlocked)
  const unlockTasksSession = () => {
    setNightModeUnlockedForSession();
    setIsTestMode(false);
    setIsNightModeActive(false);
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
        triggerSleepNow,
        triggerWakeUp,
        unlockTasksSession,
        openTestNightMode,
        closeTestNightMode,
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
