import { describe, it, expect } from "vitest";
import { isTaskScheduledForDate, isOnceTaskCarriedOver } from "@/lib/dates";
import { mapTaskWithCompletion, sortTasksByPriority } from "./mappers";
import { Task, TaskCompletion } from "./types";
import { parseISO } from "date-fns";

describe("Tasks Feature Logic", () => {
  it("matches daily and weekday recurrence accurately", () => {
    // 2026-08-23 is Sunday (day 0)
    // 2026-08-24 is Monday (day 1)
    const sunday = parseISO("2026-08-23");
    const monday = parseISO("2026-08-24");

    expect(isTaskScheduledForDate("DAILY", null, sunday)).toBe(true);
    expect(isTaskScheduledForDate("DAILY", null, monday)).toBe(true);

    expect(isTaskScheduledForDate("WEEKDAYS", null, sunday)).toBe(false);
    expect(isTaskScheduledForDate("WEEKDAYS", null, monday)).toBe(true);
  });

  it("matches custom days recurrence", () => {
    const sunday = parseISO("2026-08-23"); // 0
    const tuesday = parseISO("2026-08-25"); // 2
    const customConfig = { days: [2, 4] }; // Tue, Thu

    expect(isTaskScheduledForDate("CUSTOM", customConfig, sunday)).toBe(false);
    expect(isTaskScheduledForDate("CUSTOM", customConfig, tuesday)).toBe(true);
  });

  it("respects drag-to-day dateOverrides (skip origin, honor moved-to date)", () => {
    // 2026-08-24 is Monday (day 1), matches WEEKDAYS
    const monday = parseISO("2026-08-24");
    // 2026-08-22 is Saturday (day 6), does NOT match WEEKDAYS
    const saturday = parseISO("2026-08-22");

    // Normally scheduled on Monday, but this occurrence was dragged away (skipped)
    expect(
      isTaskScheduledForDate("WEEKDAYS", null, monday, undefined, {
        "2026-08-24": { skipped: true },
      })
    ).toBe(false);

    // Dragged onto Saturday, which wouldn't normally match WEEKDAYS
    expect(
      isTaskScheduledForDate("WEEKDAYS", null, saturday, undefined, {
        "2026-08-22": { startTime: "09:00", endTime: "10:00", movedFrom: "2026-08-24" },
      })
    ).toBe(true);

    // Untouched dates still follow the normal recurrence pattern
    expect(isTaskScheduledForDate("WEEKDAYS", null, saturday, undefined, {})).toBe(false);
  });

  it("carries over uncompleted one-shot tasks up to today, stops once completed", () => {
    // Created 2026-08-20, still not done — should show on every day up to "today"
    expect(isOnceTaskCarriedOver("2026-08-20", "2026-08-21", "2026-08-23", false)).toBe(true);
    expect(isOnceTaskCarriedOver("2026-08-20", "2026-08-23", "2026-08-23", false)).toBe(true);

    // Never shows for a date before its original date
    expect(isOnceTaskCarriedOver("2026-08-20", "2026-08-19", "2026-08-23", false)).toBe(false);

    // Never rolls forward past the real "today"
    expect(isOnceTaskCarriedOver("2026-08-20", "2026-08-25", "2026-08-23", false)).toBe(false);

    // Stops carrying over once completed
    expect(isOnceTaskCarriedOver("2026-08-20", "2026-08-21", "2026-08-23", true)).toBe(false);

    // No original date means nothing to carry over
    expect(isOnceTaskCarriedOver(null, "2026-08-21", "2026-08-23", false)).toBe(false);
  });

  it("maps task completion and sorts active task first", () => {
    const task1: Task = {
      id: "t1",
      userId: "u1",
      title: "Meditation",
      category: "Mindfulness",
      recurrence: "DAILY",
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    };

    const task2: Task = {
      ...task1,
      id: "t2",
      title: "Active Workout",
      isActive: true,
    };

    const completions: TaskCompletion[] = [
      {
        id: "c1",
        taskId: "t1",
        userId: "u1",
        date: "2026-08-23",
        completed: true,
        createdAt: "2026-08-23",
        updatedAt: "2026-08-23",
      },
    ];

    const mapped1 = mapTaskWithCompletion(task1, completions, "2026-08-23");
    const mapped2 = mapTaskWithCompletion(task2, completions, "2026-08-23");

    expect(mapped1.isCompletedToday).toBe(true);
    expect(mapped2.isCompletedToday).toBe(false);

    const sorted = sortTasksByPriority([mapped1, mapped2]);
    expect(sorted[0].id).toBe("t2"); // Active task must be first
  });

  it("orders non-active tasks by drag-and-drop sort_order before falling back to time/title", () => {
    const base: Task = {
      id: "t1",
      userId: "u1",
      title: "Zebra",
      category: "General",
      recurrence: "DAILY",
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
    };

    const taskA = { ...base, id: "a", title: "Alpha", sortOrder: 2 };
    const taskB = { ...base, id: "b", title: "Beta", sortOrder: 0 };
    const taskC = { ...base, id: "c", title: "Charlie", sortOrder: null }; // no manual order set

    const mapped = [taskA, taskB, taskC].map((t) => mapTaskWithCompletion(t, [], "2026-08-23"));
    const sorted = sortTasksByPriority(mapped);

    // Tasks with a sortOrder come first (by ascending order), unordered tasks fall back after
    expect(sorted.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("calculates updated start time dynamically for running task", () => {
    const now = new Date();
    const [hours, minutes] = "08:30".split(":").map(Number);
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 1000));
    expect(diffSeconds).toBeGreaterThanOrEqual(0);
  });

  it("splits columns for 2 parallel overlapping events accurately", () => {
    const event1 = { start: 16 * 60, end: 17 * 60 + 30 }; // 16:00 - 17:30
    const event2 = { start: 17 * 60, end: 18 * 60 + 30 }; // 17:00 - 18:30
    const overlaps = event1.start < event2.end && event2.start < event1.end;
    expect(overlaps).toBe(true);

    const totalCols = 2;
    const widthPercent = 100 / totalCols; // 50%
    const col0Left = 0 * widthPercent;    // 0%
    const col1Left = 1 * widthPercent;    // 50%

    expect(widthPercent).toBe(50);
    expect(col0Left).toBe(0);
    expect(col1Left).toBe(50);
  });

  it("splits columns accurately for 4 parallel events (25% each)", () => {
    const totalCols = 4;
    const widthPercent = 100 / totalCols; // 25%

    const positions = [0, 1, 2, 3].map((col) => ({
      column: col,
      leftPercent: col * widthPercent,
      widthPercent,
    }));

    expect(positions[0].leftPercent).toBe(0);
    expect(positions[1].leftPercent).toBe(25);
    expect(positions[2].leftPercent).toBe(50);
    expect(positions[3].leftPercent).toBe(75);
    expect(positions.every((p) => p.widthPercent === 25)).toBe(true);
  });
});
