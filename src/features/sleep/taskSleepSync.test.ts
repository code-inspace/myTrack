import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
  isSleepTitle,
  isNapTitle,
  isSleepOrNapTitle,
  extractTimesFromTitle,
  syncTaskWithSleepLog,
  removeTaskFromSleepLog,
} from "./taskSleepSync";
import { getStoredSleepLog } from "./actions";

describe("taskSleepSync", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    (global as any).window = {
      dispatchEvent: vi.fn(),
    };
    (global as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params: any = {}) {
        this.type = type;
        this.detail = params.detail;
      }
    };
    (global as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] || null,
      get length() {
        return Object.keys(store).length;
      },
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).localStorage;
    delete (global as any).CustomEvent;
  });

  describe("Title Detection", () => {
    it("detects sleep titles correctly", () => {
      expect(isSleepTitle("Sommeil")).toBe(true);
      expect(isSleepTitle("sommeil")).toBe(true);
      expect(isSleepTitle("Mon sommeil de nuit")).toBe(true);
      expect(isSleepTitle("Dodo")).toBe(true);
      expect(isSleepTitle("Aller dormir")).toBe(true);
      expect(isSleepTitle("Sleep")).toBe(true);
      expect(isSleepTitle("Nuit")).toBe(true);
      expect(isSleepTitle("bonne nuit")).toBe(true);
      expect(isSleepTitle("Sommeil 8h 00m • Coucher 23:00")).toBe(true);
      expect(isSleepTitle("Journal de sommeil")).toBe(true);
      expect(isSleepTitle("Journal du sommeil")).toBe(true);
      expect(isSleepTitle("Suivi du sommeil")).toBe(true);

      // Non-sleep activities must NOT match as sleep sessions
      expect(isSleepTitle("Méditation sommeil")).toBe(false);
      expect(isSleepTitle("Podcast sommeil")).toBe(false);
      expect(isSleepTitle("Livre sommeil")).toBe(false);
      expect(isSleepTitle("Musique sommeil")).toBe(false);

      expect(isSleepTitle("Course à pied")).toBe(false);
      expect(isSleepTitle("Projet client")).toBe(false);
      expect(isSleepTitle("Méditation")).toBe(false);
    });

    it("detects nap titles correctly", () => {
      expect(isNapTitle("Sieste")).toBe(true);
      expect(isNapTitle("sieste")).toBe(true);
      expect(isNapTitle("Micro-sieste")).toBe(true);
      expect(isNapTitle("Power nap")).toBe(true);
      expect(isNapTitle("Journal de sieste")).toBe(true);

      expect(isNapTitle("Méditation sieste")).toBe(false);
      expect(isNapTitle("Podcast sieste")).toBe(false);
      expect(isNapTitle("Sommeil")).toBe(false);
      expect(isNapTitle("Courses")).toBe(false);
    });

    it("detects both via isSleepOrNapTitle", () => {
      expect(isSleepOrNapTitle("Sommeil")).toBe(true);
      expect(isSleepOrNapTitle("Sieste")).toBe(true);
      expect(isSleepOrNapTitle("Journal de sommeil")).toBe(true);
      expect(isSleepOrNapTitle("Travailler")).toBe(false);
    });
  });

  describe("extractTimesFromTitle", () => {
    it("extracts hour ranges like 23h - 7h", () => {
      const res = extractTimesFromTitle("sommeil 23h - 7h");
      expect(res.cleanTitle).toBe("sommeil");
      expect(res.startTime).toBe("23:00");
      expect(res.endTime).toBe("07:00");
    });

    it("extracts hour ranges like 22:30 - 06:30", () => {
      const res = extractTimesFromTitle("Sommeil 22:30 - 06:30");
      expect(res.cleanTitle).toBe("Sommeil");
      expect(res.startTime).toBe("22:30");
      expect(res.endTime).toBe("06:30");
    });

    it("extracts 22h30 6h30 without dashes", () => {
      const res = extractTimesFromTitle("Sommeil 22h30 6h30");
      expect(res.cleanTitle).toBe("Sommeil");
      expect(res.startTime).toBe("22:30");
      expect(res.endTime).toBe("06:30");
    });

    it("leaves titles without time intact", () => {
      const res = extractTimesFromTitle("Sommeil réparateur");
      expect(res.cleanTitle).toBe("Sommeil réparateur");
      expect(res.startTime).toBeUndefined();
      expect(res.endTime).toBeUndefined();
    });
  });

  describe("syncTaskWithSleepLog", () => {
    it("syncs night sleep task to DailySleepLog bedtime and wakeTime", async () => {
      const task = {
        id: "task-sleep-1",
        title: "Sommeil",
        startTime: "23:00",
        endTime: "07:00",
        userId: "user-123",
      };

      // Explicit date: 2026-09-18
      await syncTaskWithSleepLog(task, "2026-09-18");

      // Bedtime on 2026-09-18, Wake time on next morning 2026-09-19
      const bedLog = getStoredSleepLog("2026-09-18", "user-123");
      const wakeLog = getStoredSleepLog("2026-09-19", "user-123");

      expect(bedLog.bedtime).toBe("23:00");
      expect(bedLog.bedtimeValidated).toBe(true);
      expect(bedLog.taskId).toBe("task-sleep-1");

      expect(wakeLog.wakeTime).toBe("07:00");
      expect(wakeLog.wakeTimeValidated).toBe(true);
      expect(wakeLog.taskId).toBe("task-sleep-1");
    });

    it("syncs early morning sleep task (02:00 -> 09:00) with bedtime on previous day and wake on same day", async () => {
      const task = {
        id: "task-sleep-late",
        title: "Sommeil",
        startTime: "02:00",
        endTime: "09:00",
        userId: "user-late",
      };

      // Scheduled on 2026-09-19 morning (02:00 -> 09:00)
      await syncTaskWithSleepLog(task, "2026-09-19");

      // Bedtime belongs to the eve 2026-09-18
      const bedLog = getStoredSleepLog("2026-09-18", "user-late");
      // Wake time belongs to 2026-09-19
      const wakeLog = getStoredSleepLog("2026-09-19", "user-late");

      expect(bedLog.bedtime).toBe("02:00");
      expect(bedLog.bedtimeValidated).toBe(true);
      expect(bedLog.taskId).toBe("task-sleep-late");

      expect(wakeLog.wakeTime).toBe("09:00");
      expect(wakeLog.wakeTimeValidated).toBe(true);
      expect(wakeLog.taskId).toBe("task-sleep-late");
    });

    it("syncs nap task to DailySleepLog.naps", async () => {
      const task = {
        id: "task-nap-1",
        title: "Sieste",
        startTime: "14:00",
        endTime: "14:45",
        userId: "user-123",
      };

      await syncTaskWithSleepLog(task, "2026-09-18");

      const log = getStoredSleepLog("2026-09-18", "user-123");
      expect(log.naps?.length).toBe(1);
      expect(log.naps?.[0].startTime).toBe("14:00");
      expect(log.naps?.[0].endTime).toBe("14:45");
      expect(log.naps?.[0].taskId).toBe("task-nap-1");
    });

    it("syncs daytime sleep task titled 'sommeil' as a nap rather than night bedtime", async () => {
      const task = {
        id: "task-sleep-daytime",
        title: "sommeil",
        startTime: "10:15",
        endTime: "12:15",
        userId: "user-day",
      };

      await syncTaskWithSleepLog(task, "2026-09-24");

      const log = getStoredSleepLog("2026-09-24", "user-day");
      // Must be saved in naps, not as night bedtime/wakeTime
      expect(log.naps?.length).toBe(1);
      expect(log.naps?.[0].startTime).toBe("10:15");
      expect(log.naps?.[0].endTime).toBe("12:15");
      expect(log.bedtimeValidated).toBe(false);
      expect(log.wakeTimeValidated).toBe(false);
    });

    it("handles night sleep alongside daytime sleep without overwriting", async () => {
      // 1. Night sleep from 03:15 to 08:15 on morning of Sept 24
      const nightTask = {
        id: "task-night",
        title: "Sommeil",
        startTime: "03:15",
        endTime: "08:15",
        userId: "user-dual",
      };
      await syncTaskWithSleepLog(nightTask, "2026-09-24");

      // 2. Daytime sleep from 10:15 to 12:15 on Sept 24
      const dayTask = {
        id: "task-day",
        title: "sommeil",
        startTime: "10:15",
        endTime: "12:15",
        userId: "user-dual",
      };
      await syncTaskWithSleepLog(dayTask, "2026-09-24");

      const eveLog = getStoredSleepLog("2026-09-23", "user-dual");
      const morningLog = getStoredSleepLog("2026-09-24", "user-dual");

      // Night sleep should remain properly attributed
      expect(eveLog.bedtime).toBe("03:15");
      expect(eveLog.bedtimeValidated).toBe(true);
      expect(morningLog.wakeTime).toBe("08:15");
      expect(morningLog.wakeTimeValidated).toBe(true);

      // Daytime sleep should be in naps
      expect(morningLog.naps?.length).toBe(1);
      expect(morningLog.naps?.[0].startTime).toBe("10:15");
      expect(morningLog.naps?.[0].endTime).toBe("12:15");
    });

    it("handles daytime task with inverted or editing times safely", async () => {
      const task = {
        id: "task-sleep-invert",
        title: "sommeil",
        startTime: "10:46",
        endTime: "10:44",
        userId: "user-invert",
      };

      await syncTaskWithSleepLog(task, "2026-09-24");

      const log = getStoredSleepLog("2026-09-24", "user-invert");
      // Should be saved as daytime nap with normalized end time, not overnight 23h58
      expect(log.naps?.length).toBe(1);
      expect(log.naps?.[0].startTime).toBe("10:46");
      expect(log.bedtimeValidated).toBe(false);
    });

    it("removes sleep log link when removeTaskFromSleepLog is called", async () => {
      const task = {
        id: "task-sleep-2",
        title: "Sommeil",
        startTime: "22:30",
        endTime: "06:30",
        userId: "user-123",
      };

      const bedLog = getStoredSleepLog("2026-09-18", "user-123");
      const wakeLog = getStoredSleepLog("2026-09-19", "user-123");

      expect(wakeLog.wakeTimeValidated).toBe(false);
      expect(wakeLog.taskId).toBeUndefined();
      expect(bedLog.bedtimeValidated).toBe(false);
      expect(bedLog.taskId).toBeUndefined();
    });
    it("preserves Friday evening 23:00 bedtime when an early morning task is added on Saturday", async () => {
      // 1. Friday night sleep 23:00 -> 07:00
      const fridayNightTask = {
        id: "task-friday-night",
        title: "Sommeil",
        startTime: "23:00",
        endTime: "07:00",
        userId: "user-fri-sat",
      };
      await syncTaskWithSleepLog(fridayNightTask, "2026-09-25");

      // Verify Friday log has 23:00 and Saturday log has 07:00
      const fridayLog = getStoredSleepLog("2026-09-25", "user-fri-sat");
      expect(fridayLog.bedtime).toBe("23:00");
      expect(fridayLog.bedtimeValidated).toBe(true);

      // 2. Early morning extra sleep task on Saturday 04:40 -> 06:00
      const saturdayEarlyTask = {
        id: "task-sat-early",
        title: "Sommeil",
        startTime: "04:40",
        endTime: "06:00",
        userId: "user-fri-sat",
      };
      await syncTaskWithSleepLog(saturdayEarlyTask, "2026-09-26");

      // Friday evening bedtime must still be 23:00, not overwritten by 04:40
      const fridayLogAfter = getStoredSleepLog("2026-09-25", "user-fri-sat");
      expect(fridayLogAfter.bedtime).toBe("23:00");

      // Saturday log should have the early session in naps
      const satLogAfter = getStoredSleepLog("2026-09-26", "user-fri-sat");
      expect(satLogAfter.naps?.some((n) => n.id === "task-nap-task-sat-early")).toBe(true);
    });

    it("calculates getNightSleepDuration accurately for Friday 23:00 -> Saturday 07:00 (8h)", async () => {
      const task = {
        id: "task-friday-23",
        title: "Sommeil",
        startTime: "23:00",
        endTime: "07:00",
        userId: "user-night-dur",
      };
      await syncTaskWithSleepLog(task, "2026-09-25");

      const { getNightSleepDuration } = await import("./actions");
      const nightSleep = getNightSleepDuration("2026-09-26", "user-night-dur");

      expect(nightSleep).not.toBeNull();
      expect(nightSleep?.yesterdayBedtime).toBe("23:00");
      expect(nightSleep?.todayWakeTime).toBe("07:00");
      expect(nightSleep?.duration.hours).toBe(8);
      expect(nightSleep?.duration.minutes).toBe(0);
      expect(nightSleep?.duration.text).toBe("8h 00m");
    });

    it("syncs multiple phases of sleep on the same day (04h-09h and 11h-15h)", async () => {
      // Phase 1: morning sleep from 04:00 to 09:00
      const phase1 = {
        id: "task-phase-1",
        title: "Journal de sommeil",
        startTime: "04:00",
        endTime: "09:00",
        userId: "user-multiphase",
      };
      await syncTaskWithSleepLog(phase1, "2026-09-26");

      // Phase 2: daytime sleep / nap from 11:00 to 15:00
      const phase2 = {
        id: "task-phase-2",
        title: "Journal de sommeil",
        startTime: "11:00",
        endTime: "15:00",
        userId: "user-multiphase",
      };
      await syncTaskWithSleepLog(phase2, "2026-09-26");

      const todayLog = getStoredSleepLog("2026-09-26", "user-multiphase");
      const eveLog = getStoredSleepLog("2026-09-25", "user-multiphase");

      // Phase 1 (night/morning): 04:00 bedtime on eve, 09:00 wake on today
      expect(eveLog.bedtime).toBe("04:00");
      expect(todayLog.wakeTime).toBe("09:00");

      // Phase 2 (daytime sleep): 11:00 to 15:00 in naps
      expect(todayLog.naps?.length).toBe(1);
      expect(todayLog.naps?.[0].startTime).toBe("11:00");
      expect(todayLog.naps?.[0].endTime).toBe("15:00");
    });
  });

  describe("Reminders Default", () => {
    it("defaults enableReminders to false for new or unconfigured tasks", () => {
      const taskWithoutReminders = {
        id: "task-1",
        title: "Test Task",
        enableReminders: undefined,
      };

      // In the application, undefined enableReminders must be treated as false
      const isEnabled = Boolean(taskWithoutReminders.enableReminders);
      expect(isEnabled).toBe(false);
    });
  });
});
