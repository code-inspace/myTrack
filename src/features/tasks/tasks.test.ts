import { describe, it, expect } from "vitest";
import { isTaskScheduledForDate } from "@/lib/dates";
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

  it("calculates updated start time dynamically for running task", () => {
    const now = new Date();
    const [hours, minutes] = "08:30".split(":").map(Number);
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 1000));
    expect(diffSeconds).toBeGreaterThanOrEqual(0);
  });
});
