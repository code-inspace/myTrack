import { describe, it, expect } from "vitest";
import {
  calculateResizedDuration,
  calculateResizedEndMinutes,
  calculateTopResizedStartMinutes,
  formatMinutesToTime,
  formatDurationMinutes,
  parseTimeToMinutes,
} from "./lib/resize";

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
});
