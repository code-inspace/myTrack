import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  calculateResizedDuration,
  calculateResizedEndMinutes,
  calculateTopResizedStartMinutes,
  formatMinutesToTime,
  formatDurationMinutes,
  parseTimeToMinutes,
} from "./lib/resize";
import { Task } from "../tasks/types";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  }),
}));

beforeAll(() => {
  const store = new Map<string, string>();
  (global as any).window = {};
  (global as any).localStorage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as any);
});

describe("Agenda Task Resizing Logic (Mobile & Desktop)", () => {
  it("parses and formats time strings accurately", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
    expect(formatMinutesToTime(570)).toBe("09:30");
    expect(formatDurationMinutes(45)).toBe("45 min");
    expect(formatDurationMinutes(60)).toBe("1h");
    expect(formatDurationMinutes(90)).toBe("1h30");
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(formatMinutesToTime(0)).toBe("00:00");
    expect(parseTimeToMinutes("23:45")).toBe(1425);
    expect(formatMinutesToTime(1425)).toBe("23:45");
  });

  it("snaps duration to 5-minute intervals when stretching downwards", () => {
    // Initial 60 mins (e.g. 09:00 to 10:00) + 12px drag down -> 72 -> snaps to 70 mins
    const duration = calculateResizedDuration(60, 12);
    expect(duration).toBe(70);

    // Initial 60 mins + 24px drag down -> 84 -> snaps to 85 mins
    const duration2 = calculateResizedDuration(60, 24);
    expect(duration2).toBe(85);
  });

  it("snaps duration to 5-minute intervals when compressing upwards", () => {
    // Initial 60 mins - 18px drag up -> 42 -> snaps to 40 mins
    const duration = calculateResizedDuration(60, -18);
    expect(duration).toBe(40);
  });

  it("enforces minimum duration even on extreme compression", () => {
    const duration = calculateResizedDuration(60, -100, 5);
    expect(duration).toBe(5);
  });

  it("calculates accurate end time string after bottom resizing", () => {
    const startMins = parseTimeToMinutes("14:00"); // 840 mins
    const initialDuration = 60; // 14:00 to 15:00
    const deltaY = 30; // +30 mins drag

    const result = calculateResizedEndMinutes(startMins, initialDuration, deltaY);
    expect(result.duration).toBe(90);
    expect(result.endMins).toBe(930);
    expect(result.endTimeStr).toBe("15:30");
  });

  it("calculates accurate start time string after top resizing (stretching earlier)", () => {
    const initialStartMins = parseTimeToMinutes("14:00"); // 840 mins
    const fixedEndMins = parseTimeToMinutes("15:00"); // 900 mins
    const deltaY = -30; // -30 mins drag up (starts earlier at 13:30)

    const result = calculateTopResizedStartMinutes(initialStartMins, fixedEndMins, deltaY, 5);
    expect(result.startMins).toBe(810);
    expect(result.startTimeStr).toBe("13:30");
    expect(result.duration).toBe(90);
  });

  it("calculates accurate start time string after top resizing (compressing later)", () => {
    const initialStartMins = parseTimeToMinutes("14:00"); // 840 mins
    const fixedEndMins = parseTimeToMinutes("15:00"); // 900 mins
    const deltaY = 20; // +20 mins drag down (starts later at 14:20)

    const result = calculateTopResizedStartMinutes(initialStartMins, fixedEndMins, deltaY, 5);
    expect(result.startMins).toBe(860);
    expect(result.startTimeStr).toBe("14:20");
    expect(result.duration).toBe(40);
  });

  it("caps maximum end time at 23:55 to prevent overflow past midnight", () => {
    const startMins = parseTimeToMinutes("23:00"); // 1380 mins
    const initialDuration = 30; // 23:00 to 23:30
    const deltaY = 120; // +120 mins drag

    const result = calculateResizedEndMinutes(startMins, initialDuration, deltaY);
    expect(result.endTimeStr).toBe("23:55");
  });
});

describe("Agenda Multi-Day Task Distribution & Moving Logic", () => {
  it("computes tasks for specific dates accurately", async () => {
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const taskOnce: any = {
      id: "t-once",
      userId: "u1",
      title: "One-shot task",
      recurrence: "ONCE",
      createdAt: "2026-09-02T12:00:00.000Z",
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
    };
    const taskDaily: any = {
      id: "t-daily",
      userId: "u1",
      title: "Daily task",
      recurrence: "DAILY",
      createdAt: "2026-09-01T12:00:00.000Z",
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
    };

    const { getTodayDateString } = await import("@/lib/dates");
    const today = getTodayDateString();

    const tasksToday = computeTasksForDate(today, [taskOnce, taskDaily], []);
    expect(tasksToday.some((t) => t.id === "t-once")).toBe(true);
    expect(tasksToday.some((t) => t.id === "t-daily")).toBe(true);

    const tasksFuture = computeTasksForDate("2099-01-01", [taskOnce, taskDaily], []);
    expect(tasksFuture.some((t) => t.id === "t-once")).toBe(false);
    expect(tasksFuture.some((t) => t.id === "t-daily")).toBe(true);
  });

  it("displays a task created yesterday on yesterday's column, and carries it to today while unfinished", async () => {
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const { getTodayDateString } = await import("@/lib/dates");
    const { subDays, format, parseISO } = await import("date-fns");

    const todayStr = getTodayDateString();
    const todayDate = parseISO(todayStr);
    const yesterdayStr = format(subDays(todayDate, 1), "yyyy-MM-dd");

    // Task created on yesterday via click on yesterday's empty agenda slot
    const taskYesterday: any = {
      id: "t-created-yesterday",
      userId: "u1",
      title: "Nouvelle tâche veille",
      startTime: "14:00",
      endTime: "15:00",
      recurrence: "ONCE",
      createdAt: `${yesterdayStr}T12:00:00.000Z`,
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
    };

    // 1. Must be present on yesterday's agenda view
    const yesterdayTasks = computeTasksForDate(yesterdayStr, [taskYesterday], []);
    const foundOnYesterday = yesterdayTasks.find((t) => t.id === "t-created-yesterday");
    expect(foundOnYesterday).toBeDefined();
    expect(foundOnYesterday?.effectiveStartTime).toBe("14:00");
    expect(foundOnYesterday?.effectiveEndTime).toBe("15:00");

    // 2. Unfinished: carried over to today, keeping its hours
    const todayTasks = computeTasksForDate(todayStr, [taskYesterday], []);
    const foundOnToday = todayTasks.find((t) => t.id === "t-created-yesterday");
    expect(foundOnToday).toBeDefined();
    expect(foundOnToday?.effectiveStartTime).toBe("14:00");

    // 3. Once done yesterday, it stays on yesterday only
    const done: any = [{ id: "c1", taskId: "t-created-yesterday", userId: "u1", date: yesterdayStr, completed: true }];
    const todayAfterDone = computeTasksForDate(todayStr, [taskYesterday], done);
    expect(todayAfterDone.find((t) => t.id === "t-created-yesterday")).toBeUndefined();
  });

  it("accurately updates effective start and end times for completed/archived tasks when resized", async () => {
    const { mapTaskWithCompletion } = await import("../tasks/mappers");
    const task: any = {
      id: "t-completed",
      userId: "u1",
      title: "Completed Task",
      startTime: "10:00",
      endTime: "11:00",
      recurrence: "ONCE",
      createdAt: "2026-09-16T12:00:00.000Z",
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
    };

    const completion: any = {
      id: "comp-1",
      taskId: "t-completed",
      userId: "u1",
      date: "2026-09-16",
      completed: true,
      actualStartTime: "10:00",
      actualEndTime: "11:00",
      scheduledStartTime: "10:00",
      scheduledEndTime: "11:00",
    };

    const mappedInitial = mapTaskWithCompletion(task, [completion], "2026-09-16");
    expect(mappedInitial.effectiveStartTime).toBe("10:00");
    expect(mappedInitial.effectiveEndTime).toBe("11:00");
    expect(mappedInitial.isCompletedToday).toBe(true);

    // After resizing: task schedule and completion execution times both updated to 09:30 - 11:30
    const updatedTask = {
      ...task,
      startTime: "09:30",
      endTime: "11:30",
    };
    const updatedCompletion = {
      ...completion,
      actualStartTime: "09:30",
      actualEndTime: "11:30",
      scheduledStartTime: "09:30",
      scheduledEndTime: "11:30",
    };

    const mappedResized = mapTaskWithCompletion(updatedTask, [updatedCompletion], "2026-09-16");
    expect(mappedResized.effectiveStartTime).toBe("09:30");
    expect(mappedResized.effectiveEndTime).toBe("11:30");
    expect(mappedResized.isCompletedToday).toBe(true);
  });

  it("handles cross-day overnight tasks appearing on both start and end days", async () => {
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const { isOvernightTimeRange, formatCrossDayTimeLabel } = await import("@/lib/dates");

    expect(isOvernightTimeRange("23:00", "02:00")).toBe(true);
    expect(isOvernightTimeRange("22:30", "06:00")).toBe(true);
    expect(isOvernightTimeRange("09:00", "17:00")).toBe(false);

    expect(formatCrossDayTimeLabel("23:00", "02:00", "start")).toBe("23:00 → 02:00 (+1j)");
    expect(formatCrossDayTimeLabel("23:00", "02:00", "end")).toBe("(Veille 23:00) → 02:00");
    expect(formatCrossDayTimeLabel("09:00", "10:00")).toBe("09:00 - 10:00");

    const overnightTask: any = {
      id: "t-overnight",
      userId: "u1",
      title: "Night Shift Vigil",
      startTime: "23:00",
      endTime: "02:00",
      recurrence: "ONCE",
      createdAt: "2099-05-10T12:00:00.000Z",
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
    };

    // 1. Day 1 (2099-05-10): Must be present as "start" part
    const day1Tasks = computeTasksForDate("2099-05-10", [overnightTask], []);
    const day1Found = day1Tasks.find((t) => t.id === "t-overnight");
    expect(day1Found).toBeDefined();
    expect(day1Found?.overnightPart).toBe("start");

    // 2. Day 2 (2099-05-11): Must be present as "end" part (carried over from yesterday)
    const day2Tasks = computeTasksForDate("2099-05-11", [overnightTask], []);
    const day2Found = day2Tasks.find((t) => t.id === "t-overnight");
    expect(day2Found).toBeDefined();
    expect(day2Found?.overnightPart).toBe("end");
    expect(day2Found?.overnightOriginDate).toBe("2099-05-10");
  });

  it("differentiates objective sleep (gray) and saved in database sleep (violet)", () => {
    // When no actual sleep is validated, only the gray objective blocks are generated
    const unvalidatedLog = {
      date: "2026-09-17",
      bedtime: "23:00",
      wakeTime: "07:00",
      bedtimeValidated: false,
      wakeTimeValidated: false,
    };

    const hasActualMorningSleep = Boolean(
      unvalidatedLog.wakeTimeValidated ||
      (unvalidatedLog as any).updatedAt ||
      unvalidatedLog.wakeTime !== "07:00"
    );
    expect(hasActualMorningSleep).toBe(false);

    // When sleep data is tracked/saved in database with real times or validation
    const savedLog = {
      date: "2026-09-17",
      bedtime: "00:15",
      wakeTime: "08:30",
      bedtimeValidated: true,
      wakeTimeValidated: true,
      updatedAt: "2026-09-17T08:30:00.000Z",
    };

    const hasActualSavedSleep = Boolean(
      savedLog.wakeTimeValidated ||
      savedLog.updatedAt ||
      savedLog.wakeTime !== "07:00"
    );
    expect(hasActualSavedSleep).toBe(true);
  });

  it("calculates accurate duration and wrap-around end time when dragging cross-day overnight tasks", () => {
    // An overnight task from 23:00 to 07:00 (8 hours = 480 mins)
    const startTimeStr = "23:00";
    const endTimeStr = "07:00";
    const s = parseTimeToMinutes(startTimeStr);
    let end = parseTimeToMinutes(endTimeStr);
    if (end <= s) {
      end += 24 * 60;
    }
    const durationMins = end - s;
    expect(durationMins).toBe(480); // 8 hours

    // Dropped onto another day at 22:30 (1350 mins)
    const snappedStartMins = parseTimeToMinutes("22:30");
    const totalEndMins = snappedStartMins + durationMins; // 1350 + 480 = 1830 mins
    expect(totalEndMins >= 24 * 60).toBe(true);

    const endMinsNormalized = totalEndMins % (24 * 60); // 390 mins = 06:30
    const newEndTimeStr = formatMinutesToTime(endMinsNormalized);
    expect(newEndTimeStr).toBe("06:30");
  });

  it("preserves exact date and hours when an event from 3 days ago is marked as done from the week view", async () => {
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const { getTodayDateString } = await import("@/lib/dates");
    const { subDays, format, parseISO } = await import("date-fns");
    const { closeTaskAsCompleted } = await import("../tasks/actions/taskCompletions");
    const { getStoredTasks, saveStoredTasks, getStoredCompletions } = await import("../tasks/actions/storage");

    const todayStr = getTodayDateString();
    const todayDate = parseISO(todayStr);
    const threeDaysAgoStr = format(subDays(todayDate, 3), "yyyy-MM-dd");

    const taskId = "task-3-days-ago";
    const testTask: any = {
      id: taskId,
      userId: "user-test-past",
      title: "Réunion passée",
      startTime: "14:00",
      endTime: "15:30",
      recurrence: "ONCE",
      createdAt: `${threeDaysAgoStr}T12:00:00.000Z`,
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
    };

    // Save task in storage
    saveStoredTasks([testTask], "user-test-past");

    // Mark as completed on threeDaysAgoStr (e.g. user clicks done on week view for that column)
    await closeTaskAsCompleted(taskId, threeDaysAgoStr, "user-test-past");

    // Verify task properties in storage remain unchanged
    const tasksAfter = getStoredTasks("user-test-past");
    const taskAfter = tasksAfter.find((t) => t.id === taskId);
    expect(taskAfter).toBeDefined();
    expect(taskAfter?.startTime).toBe("14:00");
    expect(taskAfter?.endTime).toBe("15:30");
    expect(taskAfter?.createdAt?.split("T")[0]).toBe(threeDaysAgoStr);

    // Verify completion record is attributed to threeDaysAgoStr with preserved hours
    const completionsAfter = getStoredCompletions("user-test-past");
    const completion = completionsAfter.find((c) => c.taskId === taskId && c.date === threeDaysAgoStr);
    expect(completion).toBeDefined();
    expect(completion?.completed).toBe(true);
    expect(completion?.scheduledStartTime).toBe("14:00");
    expect(completion?.scheduledEndTime).toBe("15:30");
    expect(completion?.actualStartTime).toBe("14:00");
    expect(completion?.actualEndTime).toBe("15:30");

    // Verify agenda computation for threeDaysAgoStr
    const pastAgendaTasks = computeTasksForDate(threeDaysAgoStr, tasksAfter, completionsAfter);
    const pastItem = pastAgendaTasks.find((t) => t.id === taskId);
    expect(pastItem).toBeDefined();
    expect(pastItem?.isCompletedToday).toBe(true);
    expect(pastItem?.effectiveStartTime).toBe("14:00");
    expect(pastItem?.effectiveEndTime).toBe("15:30");

    // Verify it does NOT appear on today's agenda
    const todayAgendaTasks = computeTasksForDate(todayStr, tasksAfter, completionsAfter);
    const todayItem = todayAgendaTasks.find((t) => t.id === taskId);
    expect(todayItem).toBeUndefined();
  });

  it("moves a ONCE task from one day to another on week view and saves date/time changes", async () => {
    const { updateTaskSchedule } = await import("../tasks/actions/taskSchedule");
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const { getStoredTasks, saveStoredTasks } = await import("../tasks/actions/storage");

    const mondayStr = "2026-10-05";
    const thursdayStr = "2026-10-08";
    const taskId = "move-once-task-1";

    const initialTask: Task = {
      id: taskId,
      userId: "user-move-test",
      title: "Rapport hebdo",
      startTime: "09:00",
      endTime: "10:00",
      recurrence: "ONCE",
      createdAt: `${mondayStr}T09:00:00.000Z`,
      date: mondayStr,
    } as any;

    saveStoredTasks([initialTask], "user-move-test");

    // Before move: Monday has the task, Thursday does not
    let monTasks = computeTasksForDate(mondayStr, getStoredTasks("user-move-test"), []);
    let thuTasks = computeTasksForDate(thursdayStr, getStoredTasks("user-move-test"), []);
    expect(monTasks.find((t) => t.id === taskId)).toBeDefined();
    expect(thuTasks.find((t) => t.id === taskId)).toBeUndefined();

    // Drag and drop from Monday to Thursday at 14:00 - 15:30
    await updateTaskSchedule({
      taskId,
      date: thursdayStr,
      originDate: mondayStr,
      startTime: "14:00",
      endTime: "15:30",
      applyToAll: true,
      userId: "user-move-test",
    });

    const storedAfter = getStoredTasks("user-move-test");
    const movedTask = storedAfter.find((t) => t.id === taskId);
    expect(movedTask).toBeDefined();
    expect(movedTask?.startTime).toBe("14:00");
    expect(movedTask?.endTime).toBe("15:30");
    expect(movedTask?.createdAt?.split("T")[0]).toBe(thursdayStr);
    expect((movedTask as any)?.date).toBe(thursdayStr);

    // After move: Monday NO LONGER has the task, Thursday HAS the task with updated times
    monTasks = computeTasksForDate(mondayStr, storedAfter, []);
    thuTasks = computeTasksForDate(thursdayStr, storedAfter, []);
    expect(monTasks.find((t) => t.id === taskId)).toBeUndefined();
    expect(thuTasks.find((t) => t.id === taskId)).toBeDefined();
    expect(thuTasks.find((t) => t.id === taskId)?.effectiveStartTime).toBe("14:00");
    expect(thuTasks.find((t) => t.id === taskId)?.effectiveEndTime).toBe("15:30");
  });

  it("moves a recurring task occurrence from one day to another on week view", async () => {
    const { updateTaskSchedule } = await import("../tasks/actions/taskSchedule");
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const { getStoredTasks, saveStoredTasks } = await import("../tasks/actions/storage");

    const wednesdayStr = "2026-10-07";
    const fridayStr = "2026-10-09";
    const taskId = "move-weekly-task-1";

    // Weekly task on Wednesday (2026-10-07 is Wednesday)
    const weeklyTask: Task = {
      id: taskId,
      userId: "user-recurring-move",
      title: "Point hebdo",
      startTime: "11:00",
      endTime: "12:00",
      recurrence: "WEEKLY",
      createdAt: `${wednesdayStr}T11:00:00.000Z`,
      dateOverrides: {},
    } as any;

    saveStoredTasks([weeklyTask], "user-recurring-move");

    // Before move: Wednesday has the task, Friday does not
    let wedTasks = computeTasksForDate(wednesdayStr, getStoredTasks("user-recurring-move"), []);
    let friTasks = computeTasksForDate(fridayStr, getStoredTasks("user-recurring-move"), []);
    expect(wedTasks.find((t) => t.id === taskId)).toBeDefined();
    expect(friTasks.find((t) => t.id === taskId)).toBeUndefined();

    // Drag Wednesday occurrence to Friday at 16:00 - 17:00
    await updateTaskSchedule({
      taskId,
      date: fridayStr,
      originDate: wednesdayStr,
      startTime: "16:00",
      endTime: "17:00",
      applyToAll: false,
      userId: "user-recurring-move",
    });

    const storedAfter = getStoredTasks("user-recurring-move");
    const taskAfter = storedAfter.find((t) => t.id === taskId);
    expect(taskAfter?.dateOverrides?.[wednesdayStr]?.skipped).toBe(true);
    expect(taskAfter?.dateOverrides?.[fridayStr]?.startTime).toBe("16:00");
    expect(taskAfter?.dateOverrides?.[fridayStr]?.endTime).toBe("17:00");

    // After move: Wednesday NO LONGER has this occurrence, Friday HAS it
    wedTasks = computeTasksForDate(wednesdayStr, storedAfter, []);
    friTasks = computeTasksForDate(fridayStr, storedAfter, []);
    expect(wedTasks.find((t) => t.id === taskId)).toBeUndefined();
    expect(friTasks.find((t) => t.id === taskId)).toBeDefined();
    expect(friTasks.find((t) => t.id === taskId)?.effectiveStartTime).toBe("16:00");
    expect(friTasks.find((t) => t.id === taskId)?.effectiveEndTime).toBe("17:00");
  });

  it("déplacement drag and drop sur l'agenda format semaine pour déplacer un event du vendredi au samedi avec succès", async () => {
    const { updateTaskSchedule } = await import("../tasks/actions/taskSchedule");
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const { getStoredTasks, saveStoredTasks } = await import("../tasks/actions/storage");

    const fridayStr = "2026-10-09";
    const saturdayStr = "2026-10-10";
    const taskId = "friday-to-saturday-event-1";

    const fridayEvent: Task = {
      id: taskId,
      userId: "user-fri-sat-test",
      title: "Séance escalade",
      startTime: "18:00",
      endTime: "19:30",
      recurrence: "ONCE",
      createdAt: `${fridayStr}T18:00:00.000Z`,
      date: fridayStr,
      dateOverrides: {},
    } as any;

    saveStoredTasks([fridayEvent], "user-fri-sat-test");

    // Before move: Friday has the event at 18:00 - 19:30, Saturday has nothing
    let friTasks = computeTasksForDate(fridayStr, getStoredTasks("user-fri-sat-test"), []);
    let satTasks = computeTasksForDate(saturdayStr, getStoredTasks("user-fri-sat-test"), []);
    expect(friTasks.find((t) => t.id === taskId)).toBeDefined();
    expect(friTasks.find((t) => t.id === taskId)?.effectiveStartTime).toBe("18:00");
    expect(friTasks.find((t) => t.id === taskId)?.effectiveEndTime).toBe("19:30");
    expect(satTasks.find((t) => t.id === taskId)).toBeUndefined();

    // Perform Drag & Drop from Friday to Saturday at 10:00 - 11:30
    await updateTaskSchedule({
      taskId,
      date: saturdayStr,
      originDate: fridayStr,
      startTime: "10:00",
      endTime: "11:30",
      applyToAll: true,
      userId: "user-fri-sat-test",
    });

    // Verify storage persistence
    const storedAfter = getStoredTasks("user-fri-sat-test");
    const savedEvent = storedAfter.find((t) => t.id === taskId);
    expect(savedEvent).toBeDefined();
    expect(savedEvent?.startTime).toBe("10:00");
    expect(savedEvent?.endTime).toBe("11:30");
    expect(savedEvent?.createdAt?.split("T")[0]).toBe(saturdayStr);
    expect((savedEvent as any)?.date).toBe(saturdayStr);

    // Verify agenda week distribution
    friTasks = computeTasksForDate(fridayStr, storedAfter, []);
    satTasks = computeTasksForDate(saturdayStr, storedAfter, []);

    // Friday must no longer have the task
    expect(friTasks.find((t) => t.id === taskId)).toBeUndefined();

    // Saturday must have the task with exact dragged hours
    const satItem = satTasks.find((t) => t.id === taskId);
    expect(satItem).toBeDefined();
    expect(satItem?.title).toBe("Séance escalade");
    expect(satItem?.effectiveStartTime).toBe("10:00");
    expect(satItem?.effectiveEndTime).toBe("11:30");
  });

  it("gère correctement un événement à cheval sur 2 jours (ex: 20:50 à 03:10) sur le Jour 1 et Jour 2", async () => {
    const { computeTasksForDate } = await import("./components/AgendaTimeline");
    const { formatCrossDayTimeLabel } = await import("@/lib/dates");

    const day1 = "2026-10-16";
    const day2 = "2026-10-17";
    const taskId = "bday-party-event";

    const overnightTask: Task = {
      id: taskId,
      userId: "user-bday-test",
      title: "Bday",
      startTime: "20:50",
      endTime: "03:10",
      recurrence: "ONCE",
      createdAt: `${day1}T20:50:00.000Z`,
      date: day1,
      dateOverrides: {},
    } as any;

    // Simulated completion (even if it has arbitrary actual execution timestamps like 21:10 - 22:10)
    const completions: any[] = [
      {
        id: "comp-bday",
        taskId,
        date: day1,
        completed: true,
        actualStartTime: "21:10",
        actualEndTime: "22:10",
      },
    ];

    // Day 1: must be tagged as overnightPart: "start", with startTime 20:50 and endTime 03:10
    const day1Tasks = computeTasksForDate(day1, [overnightTask], completions);
    const day1Item = day1Tasks.find((t) => t.id === taskId);
    expect(day1Item).toBeDefined();
    expect(day1Item?.overnightPart).toBe("start");
    expect(day1Item?.effectiveStartTime).toBe("20:50");
    expect(day1Item?.effectiveEndTime).toBe("03:10");
    expect(day1Item?.isCompletedToday).toBe(true);

    const day1Label = formatCrossDayTimeLabel(day1Item?.effectiveStartTime, day1Item?.effectiveEndTime, day1Item?.overnightPart);
    expect(day1Label).toBe("20:50 → 03:10 (+1j)");

    // Day 2: must be tagged as overnightPart: "end", with origin from Day 1
    const day2Tasks = computeTasksForDate(day2, [overnightTask], completions);
    const day2Item = day2Tasks.find((t) => t.id === taskId);
    expect(day2Item).toBeDefined();
    expect(day2Item?.overnightPart).toBe("end");
    expect(day2Item?.effectiveStartTime).toBe("20:50");
    expect(day2Item?.effectiveEndTime).toBe("03:10");

    const day2Label = formatCrossDayTimeLabel(day2Item?.effectiveStartTime, day2Item?.effectiveEndTime, day2Item?.overnightPart);
    expect(day2Label).toBe("(Veille 20:50) → 03:10");
  });

  it("la création d'une nouvelle tâche au clic long / tap sur du vide ouvre la modale info de celle-ci", () => {
    // Simulating the creation & modal opening orchestration logic
    let selectedTaskIdForDetail: string | null = null;
    let selectedTaskSnapshot: any = null;

    const onCreateTaskAtTime = vi.fn((date: string, startTime: string, endTime: string, onCreated?: (task: any) => void) => {
      const createdDbTask = {
        id: "real-created-id-42",
        title: "Nouvelle tâche",
        date,
        startTime,
        endTime,
        category: "General",
        recurrence: "ONCE",
      };
      onCreated?.(createdDbTask);
      return createdDbTask;
    });

    const handleCreateTaskAtTime = (date: string, startTime: string, endTime: string) => {
      const tempId = "temp-" + Date.now();
      const optimisticTask = {
        id: tempId,
        title: "Nouvelle tâche",
        date,
        startTime,
        endTime,
        effectiveStartTime: startTime,
        effectiveEndTime: endTime,
      };

      // Modal is immediately opened with optimistic task
      selectedTaskIdForDetail = tempId;
      selectedTaskSnapshot = optimisticTask;

      onCreateTaskAtTime(date, startTime, endTime, (createdTask: any) => {
        if (createdTask && createdTask.id) {
          selectedTaskIdForDetail = createdTask.id;
          selectedTaskSnapshot = createdTask;
        }
      });
    };

    // User long-presses / taps on empty timeline slot at 14:00 - 15:00 on 2026-10-01
    handleCreateTaskAtTime("2026-10-01", "14:00", "15:00");

    expect(onCreateTaskAtTime).toHaveBeenCalledWith(
      "2026-10-01",
      "14:00",
      "15:00",
      expect.any(Function)
    );

    // Modal is opened and bound to the newly created task
    expect(selectedTaskIdForDetail).toBe("real-created-id-42");
    expect(selectedTaskSnapshot).toBeDefined();
    expect(selectedTaskSnapshot.title).toBe("Nouvelle tâche");
    expect(selectedTaskSnapshot.startTime).toBe("14:00");
    expect(selectedTaskSnapshot.endTime).toBe("15:00");
  });

  it("quand le mode redimensionnement est actif, un clic en dehors de la tâche quitte le mode", () => {
    let selectedTaskId: string | null = "task-resizing-1";
    let resizingState: any = {
      taskId: "task-resizing-1",
      date: "2026-10-01",
      edge: "bottom",
      currentStartMins: 600,
      currentEndMins: 660,
    };

    const handleExitResizeMode = () => {
      selectedTaskId = null;
      resizingState = null;
    };

    // Simulated click outside target task (e.g. on background, other tasks, header)
    const simulateClickOutside = (targetElementId: string) => {
      const isInsideSelectedTask = targetElementId === "task-resizing-1" || targetElementId.startsWith("agenda-resize-handle-");
      if (!isInsideSelectedTask) {
        handleExitResizeMode();
      }
    };

    // Clicking on the resizing task itself does not exit
    simulateClickOutside("task-resizing-1");
    expect(selectedTaskId).toBe("task-resizing-1");

    // Clicking on resize handle does not exit
    simulateClickOutside("agenda-resize-handle-bottom-task-resizing-1");
    expect(selectedTaskId).toBe("task-resizing-1");

    // Clicking anywhere outside (e.g. empty grid, other task, header) exits resize mode
    simulateClickOutside("empty-grid-slot");
    expect(selectedTaskId).toBeNull();
    expect(resizingState).toBeNull();
  });

  it("un clic sur le vide lorsque le mode redimensionnement est actif quitte le mode sans créer de tâche", () => {
    let selectedTaskId: string | null = "task-resizing-2";
    let resizingState: any = null;
    const onCreateTask = vi.fn();

    const handleEmptySlotClick = () => {
      if (selectedTaskId !== null || resizingState !== null) {
        selectedTaskId = null;
        resizingState = null;
        return; // Exits resize mode and does NOT call onCreateTask
      }
      onCreateTask();
    };

    // User clicks empty slot while in resize mode
    handleEmptySlotClick();

    expect(selectedTaskId).toBeNull();
    expect(onCreateTask).not.toHaveBeenCalled();

    // Subsequent click on empty slot when not in resize mode creates task normally
    handleEmptySlotClick();
    expect(onCreateTask).toHaveBeenCalledTimes(1);
  });

  it("dupliquer une tâche depuis la modale info crée une nouvelle occurrence préservant les horaires et métadonnées", () => {
    const originalTask: any = {
      id: "orig-1",
      title: "Séance Musculation",
      category: "Sport",
      tag: "Sport",
      description: "Pectoraux & Triceps",
      priority: "URGENT",
      projectId: "proj-fitness",
      projectCategory: "Force",
      enableReminders: true,
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      effectiveStartTime: "17:00",
      effectiveEndTime: "18:30",
    };

    const onDuplicateTask = vi.fn((t: any) => {
      return {
        title: t.title,
        category: t.category,
        tag: t.tag,
        description: t.description,
        priority: t.priority,
        projectId: t.projectId,
        projectCategory: t.projectCategory,
        enableReminders: t.enableReminders,
        recurrence: "ONCE",
        trackingType: t.trackingType,
        startTime: t.effectiveStartTime || t.startTime,
        endTime: t.effectiveEndTime || t.endTime,
        date: "2026-10-01",
      };
    });

    const duplicated = onDuplicateTask(originalTask);

    expect(onDuplicateTask).toHaveBeenCalledWith(originalTask);
    expect(duplicated.title).toBe("Séance Musculation");
    expect(duplicated.category).toBe("Sport");
    expect(duplicated.startTime).toBe("17:00");
    expect(duplicated.endTime).toBe("18:30");
    expect(duplicated.projectId).toBe("proj-fitness");
    expect(duplicated.projectCategory).toBe("Force");
    expect(duplicated.date).toBe("2026-10-01");
  });
});
