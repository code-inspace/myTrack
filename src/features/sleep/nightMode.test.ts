import { describe, it, expect } from "vitest";
import {
  isCurrentlyInSleepWindow,
  getNextBedtimeIso,
  isNightModeFeatureEnabled,
  setNightModeFeatureEnabled,
  isNightModeInactivityAutoLockEnabled,
  setNightModeInactivityAutoLockEnabled,
  isNightModeUnlockedForSession,
  setNightModeUnlockedForSession,
  clearNightModeSessionUnlock,
} from "./nightModeUtils";

describe("Night Mode Sleep Window & Logic", () => {
  it("detects when current time is in standard overnight sleep window (22:30 -> 07:15)", () => {
    const bedtime = "22:30";
    const wakeTime = "07:15";

    // 22:35 (Night before) -> in window
    const time2235 = new Date(2026, 7, 27, 22, 35);
    expect(isCurrentlyInSleepWindow(time2235, bedtime, wakeTime)).toBe(true);

    // 03:00 (Middle of the night) -> in window
    const time0300 = new Date(2026, 7, 28, 3, 0);
    expect(isCurrentlyInSleepWindow(time0300, bedtime, wakeTime)).toBe(true);

    // 07:10 (Just before wake) -> in window
    const time0710 = new Date(2026, 7, 28, 7, 10);
    expect(isCurrentlyInSleepWindow(time0710, bedtime, wakeTime)).toBe(true);

    // 07:20 (After wake) -> outside window
    const time0720 = new Date(2026, 7, 28, 7, 20);
    expect(isCurrentlyInSleepWindow(time0720, bedtime, wakeTime)).toBe(false);

    // 14:30 (Daytime) -> outside window
    const time1430 = new Date(2026, 7, 28, 14, 30);
    expect(isCurrentlyInSleepWindow(time1430, bedtime, wakeTime)).toBe(false);

    // 22:15 (Before bedtime) -> outside window
    const time2215 = new Date(2026, 7, 27, 22, 15);
    expect(isCurrentlyInSleepWindow(time2215, bedtime, wakeTime)).toBe(false);
  });

  it("calculates next bedtime ISO correctly upon waking up", () => {
    // Waking up at 07:30 in the morning on 2026-08-28, bedtime is 23:00
    const morningTime = new Date(2026, 7, 28, 7, 30);
    const nextBedtime = getNextBedtimeIso("23:00", morningTime);
    const nextBedtimeDate = new Date(nextBedtime);

    expect(nextBedtimeDate.getDate()).toBe(28);
    expect(nextBedtimeDate.getHours()).toBe(23);
    expect(nextBedtimeDate.getMinutes()).toBe(0);

    // Waking up late at 23:45 (after today's 23:00 bedtime) -> next bedtime is tomorrow
    const lateNightTime = new Date(2026, 7, 28, 23, 45);
    const nextBedtimeFromLate = getNextBedtimeIso("23:00", lateNightTime);
    const nextBedtimeFromLateDate = new Date(nextBedtimeFromLate);

    expect(nextBedtimeFromLateDate.getDate()).toBe(29);
    expect(nextBedtimeFromLateDate.getHours()).toBe(23);
  });

  it("handles settings toggles and session unlocking", () => {
    const memoryStore: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => memoryStore[k] || null,
      setItem: (k: string, v: string) => { memoryStore[k] = v; },
      removeItem: (k: string) => { delete memoryStore[k]; },
    };

    (globalThis as any).window = {
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      dispatchEvent: () => true,
    };
    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).sessionStorage = mockStorage;

    // Session unlock
    setNightModeUnlockedForSession();
    expect(isNightModeUnlockedForSession()).toBe(true);
    clearNightModeSessionUnlock();
    expect(isNightModeUnlockedForSession()).toBe(false);

    // Feature enabled toggle
    setNightModeFeatureEnabled(false);
    expect(isNightModeFeatureEnabled()).toBe(false);
    setNightModeFeatureEnabled(true);
    expect(isNightModeFeatureEnabled()).toBe(true);

    // Inactivity autolock toggle
    setNightModeInactivityAutoLockEnabled(false);
    expect(isNightModeInactivityAutoLockEnabled()).toBe(false);
    setNightModeInactivityAutoLockEnabled(true);
    expect(isNightModeInactivityAutoLockEnabled()).toBe(true);
  });
});
