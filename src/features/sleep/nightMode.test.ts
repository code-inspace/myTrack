import { describe, it, expect, vi } from "vitest";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/onesignal/client", () => ({
  scheduleTaskPushNotification: vi.fn().mockResolvedValue(undefined),
  cancelTaskPushNotifications: vi.fn().mockResolvedValue(undefined),
}));
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

  it("getEffectiveBedDate attributes early morning bedtimes (< 07:00) to previous day", async () => {
    const { getEffectiveBedDate } = await import("./actions");

    // 02:00 on 2026-09-22 belongs to night of 2026-09-21
    expect(getEffectiveBedDate("02:00", "2026-09-22")).toBe("2026-09-21");
    // 00:30 on 2026-09-22 belongs to night of 2026-09-21
    expect(getEffectiveBedDate("00:30", "2026-09-22")).toBe("2026-09-21");
    // 06:45 on 2026-09-22 belongs to night of 2026-09-21
    expect(getEffectiveBedDate("06:45", "2026-09-22")).toBe("2026-09-21");

    // 23:00 on 2026-09-21 belongs to night of 2026-09-21
    expect(getEffectiveBedDate("23:00", "2026-09-21")).toBe("2026-09-21");
    // 22:30 on 2026-09-21 belongs to night of 2026-09-21
    expect(getEffectiveBedDate("22:30", "2026-09-21")).toBe("2026-09-21");
  });

  it("calculates correct sleep duration when bedtime was 2h du matin", async () => {
    const { getStoredSleepLog, saveStoredSleepLog, getNightSleepDuration } = await import("./actions");

    // Monday (2026-09-21) night has bedtime 02:00 (saved for the night)
    await saveStoredSleepLog({
      date: "2026-09-21",
      bedtime: "02:00",
      bedtimeValidated: true,
      wakeTime: "07:00",
      wakeTimeValidated: false,
    }, "user-test-night");

    // Tuesday (2026-09-22) morning wake up at 09:00
    await saveStoredSleepLog({
      date: "2026-09-22",
      bedtime: "23:00", // Default or unvalidated for Tuesday evening
      bedtimeValidated: false,
      wakeTime: "09:00",
      wakeTimeValidated: true,
    }, "user-test-night");

    // Wednesday (2026-09-23) morning wake up at 07:00
    await saveStoredSleepLog({
      date: "2026-09-23",
      bedtime: "23:00",
      bedtimeValidated: false,
      wakeTime: "07:00",
      wakeTimeValidated: true,
    }, "user-test-night");

    // Tuesday morning sleep duration: Monday 02:00 -> Tuesday 09:00 = 7h 00m
    const tuesdayDuration = getNightSleepDuration("2026-09-22", "user-test-night");
    expect(tuesdayDuration).not.toBeNull();
    expect(tuesdayDuration?.yesterdayBedtime).toBe("02:00");
    expect(tuesdayDuration?.todayWakeTime).toBe("09:00");
    expect(tuesdayDuration?.duration.hours).toBe(7);
    expect(tuesdayDuration?.duration.minutes).toBe(0);
    expect(tuesdayDuration?.duration.text).toBe("7h 00m");

    // Wednesday morning sleep duration: Tuesday 23:00 -> Wednesday 07:00 = 8h 00m (NOT 02:00!)
    const wednesdayDuration = getNightSleepDuration("2026-09-23", "user-test-night");
    expect(wednesdayDuration).not.toBeNull();
    expect(wednesdayDuration?.yesterdayBedtime).toBe("23:00");
    expect(wednesdayDuration?.todayWakeTime).toBe("07:00");
    expect(wednesdayDuration?.duration.hours).toBe(8);
  });

  it("updates yesterday's bedtime independently without overwriting today's bedtime or global target", async () => {
    const {
      getStoredSleepLog,
      saveStoredSleepLog,
      getStoredSleepTarget,
      saveStoredSleepTarget,
      getNightSleepDuration,
    } = await import("./actions");

    const userId = "user-test-yesterday-edit";

    // Set a global sleep target (23:30 -> 07:30)
    saveStoredSleepTarget({ targetBedtime: "23:30", targetWakeTime: "07:30" }, userId);
    expect(getStoredSleepTarget(userId).targetBedtime).toBe("23:30");

    // Initialize yesterday (2026-09-20) with default bedtime
    await saveStoredSleepLog(
      {
        date: "2026-09-20",
        bedtime: "23:30",
        bedtimeValidated: true,
        wakeTime: "07:30",
        wakeTimeValidated: true,
      },
      userId
    );

    // Initialize today (2026-09-21)
    await saveStoredSleepLog(
      {
        date: "2026-09-21",
        bedtime: "23:30",
        bedtimeValidated: false,
        wakeTime: "08:00",
        wakeTimeValidated: true,
      },
      userId
    );

    // Initial sleep duration for today (night 20->21): 23:30 to 08:00 = 8h 30m
    const initialDuration = getNightSleepDuration("2026-09-21", userId);
    expect(initialDuration?.yesterdayBedtime).toBe("23:30");
    expect(initialDuration?.duration.text).toBe("8h 30m");

    // USER ACTION: Change yesterday's bedtime to 22:15
    const yesterdayLog = getStoredSleepLog("2026-09-20", userId);
    await saveStoredSleepLog(
      {
        ...yesterdayLog,
        bedtime: "22:15",
        bedtimeValidated: true,
      },
      userId
    );

    // Check yesterday's log is properly updated
    const updatedYesterdayLog = getStoredSleepLog("2026-09-20", userId);
    expect(updatedYesterdayLog.bedtime).toBe("22:15");
    expect(updatedYesterdayLog.bedtimeValidated).toBe(true);

    // Check that today's log was NOT overwritten by yesterday's edit
    const todayLog = getStoredSleepLog("2026-09-21", userId);
    expect(todayLog.bedtime).toBe("23:30");
    expect(todayLog.bedtimeValidated).toBe(false);
    expect(todayLog.wakeTime).toBe("08:00");

    // Check that global target was NOT overwritten
    const currentTarget = getStoredSleepTarget(userId);
    expect(currentTarget.targetBedtime).toBe("23:30");
    expect(currentTarget.targetWakeTime).toBe("07:30");

    // Sleep duration for today (night 20->21) is recalculated with the new yesterday bedtime: 22:15 to 08:00 = 9h 45m
    const updatedDuration = getNightSleepDuration("2026-09-21", userId);
    expect(updatedDuration?.yesterdayBedtime).toBe("22:15");
    expect(updatedDuration?.todayWakeTime).toBe("08:00");
    expect(updatedDuration?.duration.hours).toBe(9);
    expect(updatedDuration?.duration.minutes).toBe(45);
    expect(updatedDuration?.duration.text).toBe("9h 45m");
  });
});

