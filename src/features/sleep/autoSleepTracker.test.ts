import { describe, it, expect, beforeEach, vi } from "vitest";

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
  scheduleTaskPushNotification: vi.fn().mockImplementation(() => Promise.resolve({ success: true })),
  cancelTaskPushNotifications: vi.fn().mockImplementation(() => Promise.resolve({ success: true })),
}));

vi.mock("@/features/notifications/reminderActions", () => ({
  createDbReminder: vi.fn().mockImplementation(() => Promise.resolve({ success: true })),
  cancelDbReminder: vi.fn().mockImplementation(() => Promise.resolve({ success: true })),
}));

import {
  recordAppBackground,
  processAppForeground,
  STORAGE_KEY_LAST_CLOSED,
} from "./autoSleepTracker";
import { getStoredSleepLog, saveStoredSleepLog } from "./actions";

describe("AutoSleepTracker", () => {
  let memoryStore: Record<string, string> = {};

  beforeEach(() => {
    memoryStore = {};
    const mockStorage = {
      getItem: (k: string) => memoryStore[k] || null,
      setItem: (k: string, v: string) => { memoryStore[k] = v; },
      removeItem: (k: string) => { delete memoryStore[k]; },
      clear: () => { memoryStore = {}; },
    };

    (globalThis as any).window = {
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      dispatchEvent: () => true,
    };
    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).sessionStorage = mockStorage;
  });

  it("records last closed timestamp and candidate bedtime on app background", () => {
    const eveningDate = new Date("2026-09-15T23:30:00");
    recordAppBackground(eveningDate);

    expect(localStorage.getItem(STORAGE_KEY_LAST_CLOSED)).toBe(eveningDate.toISOString());

    const log = getStoredSleepLog("2026-09-15");
    expect(log.bedtime).toBe("23:30");
  });

  it("automatically detects main sleep based on absence duration (e.g. 7h45)", () => {
    // 1. App closed at 23:30 on 2026-09-15
    const eveningDate = new Date("2026-09-15T23:30:00");
    recordAppBackground(eveningDate);

    // 2. App opened at 07:15 on 2026-09-16 (gap of 7h45m = 465 minutes)
    const morningDate = new Date("2026-09-16T07:15:00");
    const result = processAppForeground(morningDate);

    expect(result.detected).toBe(true);
    expect(result.bedtime).toBe("23:30");
    expect(result.wakeTime).toBe("07:15");
    expect(result.bedtimeDate).toBe("2026-09-15");
    expect(result.wakeDate).toBe("2026-09-16");
    expect(result.durationMinutes).toBe(465);

    // Check saved logs
    const yesterdayLog = getStoredSleepLog("2026-09-15");
    const todayLog = getStoredSleepLog("2026-09-16");

    expect(yesterdayLog.bedtime).toBe("23:30");
    expect(todayLog.wakeTime).toBe("07:15");
  });

  it("handles late-night closing (e.g. 01:15) and morning opening (08:30)", () => {
    // App closed at 01:15 AM on 2026-09-16
    const lateNightDate = new Date("2026-09-16T01:15:00");
    recordAppBackground(lateNightDate);

    // App opened at 08:30 AM on 2026-09-16 (gap of 7h15m = 435 minutes)
    const morningDate = new Date("2026-09-16T08:30:00");
    const result = processAppForeground(morningDate);

    expect(result.detected).toBe(true);
    expect(result.bedtime).toBe("01:15");
    expect(result.wakeTime).toBe("08:30");
    expect(result.bedtimeDate).toBe("2026-09-15"); // eve of wakeDate
    expect(result.wakeDate).toBe("2026-09-16");
  });

  it("detects sleep on non-standard hours (shift work, day sleep)", () => {
    // App closed in morning at 07:00
    const sleepDate = new Date("2026-09-16T07:00:00");
    recordAppBackground(sleepDate);

    // App opened in afternoon at 15:30 (absence of 8h30m = 510 minutes)
    const wakeDate = new Date("2026-09-16T15:30:00");
    const result = processAppForeground(wakeDate);

    expect(result.detected).toBe(true);
    expect(result.bedtime).toBe("07:00");
    expect(result.wakeTime).toBe("15:30");
    expect(result.durationMinutes).toBe(510);
  });

  it("automatically records a nap for absence between 20 min and 3h", () => {
    // App closed at 13:30
    const closeDate = new Date("2026-09-16T13:30:00");
    recordAppBackground(closeDate);

    // App reopened at 14:45 (gap of 75 minutes = 1h15)
    const openDate = new Date("2026-09-16T14:45:00");
    const result = processAppForeground(openDate);

    expect(result.detected).toBe(true);
    expect(result.durationMinutes).toBe(75);

    const log = getStoredSleepLog("2026-09-16");
    expect(log.naps?.length).toBeGreaterThan(0);
    expect(log.naps?.[0].startTime).toBe("13:30");
    expect(log.naps?.[0].endTime).toBe("14:45");
  });

  it("does not detect sleep for very short absence (< 20 minutes)", () => {
    // App closed at 10:00
    const closeDate = new Date("2026-09-16T10:00:00");
    recordAppBackground(closeDate);

    // App reopened at 10:10 (10 minutes)
    const openDate = new Date("2026-09-16T10:10:00");
    const result = processAppForeground(openDate);

    expect(result.detected).toBe(false);
    expect(result.reason).toContain("Duration too short");
  });

  it("does not overwrite manually validated bedtime or wake time", () => {
    // User already validated wakeTime = "06:45"
    saveStoredSleepLog({
      date: "2026-09-16",
      wakeTime: "06:45",
      wakeTimeValidated: true,
      bedtimeReminders: [],
      enableBedtimeReminders: true,
    });

    // App closed yesterday at 23:00
    recordAppBackground(new Date("2026-09-15T23:00:00"));

    // App opened at 09:00
    const morningDate = new Date("2026-09-16T09:00:00");
    processAppForeground(morningDate);

    const log = getStoredSleepLog("2026-09-16");
    expect(log.wakeTime).toBe("06:45"); // Preserved user's manually validated time!
  });
});
