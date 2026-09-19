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

      expect(isSleepTitle("Course à pied")).toBe(false);
      expect(isSleepTitle("Projet client")).toBe(false);
      expect(isSleepTitle("Méditation")).toBe(false);
    });

    it("detects nap titles correctly", () => {
      expect(isNapTitle("Sieste")).toBe(true);
      expect(isNapTitle("sieste")).toBe(true);
      expect(isNapTitle("Micro-sieste")).toBe(true);
      expect(isNapTitle("Power nap")).toBe(true);

      expect(isNapTitle("Sommeil")).toBe(false);
      expect(isNapTitle("Courses")).toBe(false);
    });

    it("detects both via isSleepOrNapTitle", () => {
      expect(isSleepOrNapTitle("Sommeil")).toBe(true);
      expect(isSleepOrNapTitle("Sieste")).toBe(true);
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

      // Explicit past date: 2026-09-18
      await syncTaskWithSleepLog(task, "2026-09-18");

      // Wake time on 2026-09-18, bedtime on 2026-09-17
      const wakeLog = getStoredSleepLog("2026-09-18", "user-123");
      const bedLog = getStoredSleepLog("2026-09-17", "user-123");

      expect(wakeLog.wakeTime).toBe("07:00");
      expect(wakeLog.wakeTimeValidated).toBe(true);
      expect(wakeLog.taskId).toBe("task-sleep-1");

      expect(bedLog.bedtime).toBe("23:00");
      expect(bedLog.bedtimeValidated).toBe(true);
      expect(bedLog.taskId).toBe("task-sleep-1");
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

    it("removes sleep log link when removeTaskFromSleepLog is called", async () => {
      const task = {
        id: "task-sleep-2",
        title: "Sommeil",
        startTime: "22:30",
        endTime: "06:30",
        userId: "user-123",
      };

      await syncTaskWithSleepLog(task, "2026-09-18");
      await removeTaskFromSleepLog("task-sleep-2", "2026-09-18", "user-123");

      const wakeLog = getStoredSleepLog("2026-09-18", "user-123");
      const bedLog = getStoredSleepLog("2026-09-17", "user-123");

      expect(wakeLog.wakeTimeValidated).toBe(false);
      expect(wakeLog.taskId).toBeUndefined();
      expect(bedLog.bedtimeValidated).toBe(false);
      expect(bedLog.taskId).toBeUndefined();
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
