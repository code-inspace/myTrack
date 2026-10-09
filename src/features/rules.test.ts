import { describe, it, expect } from "vitest";
import { parseISO } from "date-fns";
import {
  getTargetDurationMinutes,
  getDefaultTaskDurationMinutes,
  getCompletionMinutes,
  getCompletionFieldsAfterReschedule,
  DEFAULT_TASK_DURATION_MINUTES,
} from "@/features/tasks/durationRules";
import {
  getDoneColumnId,
  getFirstColumnId,
  isTaskInDoneColumn,
  resolveAllBoardColumnId,
  resolveStatusForAllBoardColumn,
} from "@/features/projects/types";
import { isNightSleepTime, isAfterMidnightBedtime } from "@/features/sleep/sleepRules";
import { convertZonedTimeToUtc, getZonedDateTimeParts } from "@/lib/dates";
import { serializeDateOverridesForDb, mapDbTaskToModel } from "@/features/tasks/actions/mappers";
import {
  calculateHabitStreak,
  calculateDashboardStats,
  calculateLast7DaysStatus,
  getPeriodRange,
  TaskRecord,
  CompletionRecord,
} from "@/features/analytics/calculations";
import { computeGoalProgress } from "@/features/goals/actions";
import { Goal } from "@/features/goals/types";
import { Task } from "@/features/tasks/types";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { createWidgetToken, verifyWidgetToken } from "@/lib/supabase/serverAuth";

describe("duration rules", () => {
  it("only reads targetValue as minutes for DURATION tasks", () => {
    expect(getTargetDurationMinutes({ trackingType: "DURATION", targetValue: 45, unit: "min" })).toBe(45);
    expect(getTargetDurationMinutes({ trackingType: "DURATION", targetValue: 2, unit: "h" })).toBe(120);
    expect(getTargetDurationMinutes({ trackingType: "NUMBER", targetValue: 50, unit: "reps" })).toBeNull();
    expect(getDefaultTaskDurationMinutes({ trackingType: "QUANTITY", targetValue: 2, unit: "litres" })).toBe(
      DEFAULT_TASK_DURATION_MINUTES,
    );
  });

  it("prefers the measured (accumulated) duration over the start→end span", () => {
    // two timer sessions 09:00-10:00 and 14:00-15:00: span is 6h, real time is 2h
    expect(getCompletionMinutes({ duration: 120, actualStartTime: "09:00", actualEndTime: "15:00" })).toBe(120);
    expect(getCompletionMinutes({ duration: null, actualStartTime: "09:00", actualEndTime: "09:45" })).toBe(45);
  });

  it("moves recorded times with the agenda block and recomputes a completed duration", () => {
    const done = getCompletionFieldsAfterReschedule(
      { completed: true, duration: 30, actualStartTime: "09:00", actualEndTime: "09:30" },
      "10:00",
      "11:30",
    );
    expect(done).toMatchObject({ actualStartTime: "10:00", actualEndTime: "11:30", duration: 90 });

    const planned = getCompletionFieldsAfterReschedule(
      { completed: false, duration: null, actualStartTime: null, actualEndTime: null },
      "10:00",
      "11:00",
    );
    expect(planned).toMatchObject({ scheduledStartTime: "10:00", actualStartTime: null, actualEndTime: null });
  });
});

describe("kanban column rules", () => {
  const custom = { id: "p1", columns: [{ id: "col-a", label: "Backlog" }, { id: "col-z", label: "Livré", isDone: true }] };

  it("uses the project's own first/done columns, and TODO/DONE without project", () => {
    expect(getFirstColumnId(custom)).toBe("col-a");
    expect(getDoneColumnId(custom)).toBe("col-z");
    expect(getFirstColumnId(null)).toBe("TODO");
    expect(getDoneColumnId(null)).toBe("DONE");
  });

  it("detects the done column by its custom id", () => {
    expect(isTaskInDoneColumn({ projectId: "p1", projectStatus: "col-z" }, [custom])).toBe(true);
    expect(isTaskInDoneColumn({ projectId: "p1", projectStatus: "DONE" }, [custom])).toBe(false);
    expect(isTaskInDoneColumn({ projectId: null, projectStatus: "DONE" })).toBe(true);
  });

  it("keeps the status of a task without project when read from the DB", () => {
    const task = mapDbTaskToModel({ id: "t", title: "x", project_id: null, project_status: "DONE" });
    expect(task.projectStatus).toBe("DONE");
    expect(task.enableReminders).toBe(false);
  });
});

describe("sleep rules", () => {
  it("uses one night window (18:00 → 07:00) everywhere", () => {
    expect(isNightSleepTime("19:00")).toBe(true);
    expect(isNightSleepTime("06:59")).toBe(true);
    expect(isNightSleepTime("14:00")).toBe(false);
    expect(isAfterMidnightBedtime("01:30")).toBe(true);
    expect(isAfterMidnightBedtime("23:30")).toBe(false);
  });
});

describe("timezone helpers (server side)", () => {
  it("converts a local wall-clock time to UTC in an explicit zone, DST included", () => {
    expect(convertZonedTimeToUtc("23:00", "2026-01-15", "Europe/Paris")).toBe("22:00");
    expect(convertZonedTimeToUtc("23:00", "2026-07-15", "Europe/Paris")).toBe("21:00");
    expect(convertZonedTimeToUtc("08:00", "2026-07-15", "UTC")).toBe("08:00");
  });

  it("gives the user's local date, not the server's", () => {
    // 23:30 UTC is already the next day in Paris
    const instant = new Date("2026-07-15T23:30:00.000Z");
    expect(getZonedDateTimeParts(instant, "Europe/Paris")).toEqual({ dateStr: "2026-07-16", timeStr: "01:30" });
    expect(getZonedDateTimeParts(instant, "America/New_York").dateStr).toBe("2026-07-15");
  });

  it("serializes every per-date override to UTC and leaves metadata untouched", () => {
    const local = {
      _enableReminders: true,
      "2026-07-15": { startTime: "10:00", endTime: "11:00" },
      "2026-07-16": { skipped: true },
    };
    const db = serializeDateOverridesForDb(local);
    expect(db._enableReminders).toBe(true);
    expect(db["2026-07-16"]).toEqual({ skipped: true });
    // round-trip through the read mapper gives the local times back
    const roundTrip = mapDbTaskToModel({ id: "t", title: "x", date_overrides: db });
    expect(roundTrip.dateOverrides?.["2026-07-15"]).toMatchObject({ startTime: "10:00", endTime: "11:00" });
  });
});

describe("widget token", () => {
  it("only accepts tokens signed for that user", () => {
    process.env.WIDGET_TOKEN_SECRET = "test-secret";
    const token = createWidgetToken("user-a")!;
    expect(verifyWidgetToken(token)).toBe("user-a");
    expect(verifyWidgetToken(token.replace("user-a", "user-b"))).toBeNull();
    expect(verifyWidgetToken("v1.user-a.forged")).toBeNull();
    expect(verifyWidgetToken(null)).toBeNull();
  });
});

describe("habit statistics rules", () => {
  const weekdays: TaskRecord = {
    id: "w",
    title: "Lun-Ven",
    category: "General",
    recurrence: "WEEKDAYS",
    trackingType: "BOOLEAN",
    createdAt: "2026-08-01T12:00:00.000Z",
  };

  it("doesn't break a Mon–Fri habit streak over the week-end", () => {
    // 2026-08-10 is a Monday; Fri 7 + Thu 6 done, week-end skipped
    const completions: CompletionRecord[] = [
      { id: "1", taskId: "w", date: "2026-08-06", completed: true },
      { id: "2", taskId: "w", date: "2026-08-07", completed: true },
      { id: "3", taskId: "w", date: "2026-08-10", completed: true },
    ];
    expect(calculateHabitStreak("w", completions, parseISO("2026-08-10"), weekdays)).toBe(3);
  });

  it("ignores moved/skipped occurrences, archived habits and days before the start date", () => {
    const daily: TaskRecord = {
      id: "d",
      title: "Daily",
      category: "General",
      recurrence: "DAILY",
      trackingType: "BOOLEAN",
      createdAt: "2026-08-20T12:00:00.000Z",
      dateOverrides: { "2026-08-21": { skipped: true } },
    };
    const archived: TaskRecord = { ...daily, id: "a", isArchived: true, dateOverrides: null };
    const days = calculateLast7DaysStatus([daily, archived], [], parseISO("2026-08-23"));
    const byDate = Object.fromEntries(days.map((d) => [d.date, d.totalScheduled]));
    expect(byDate["2026-08-19"]).toBe(0); // before start
    expect(byDate["2026-08-21"]).toBe(0); // skipped occurrence
    expect(byDate["2026-08-22"]).toBe(1); // archived habit not counted
  });

  it("uses calendar periods and gives no momentum without activity", () => {
    const range = getPeriodRange("week", parseISO("2026-08-19")); // Wednesday
    expect(range.start.getDay()).toBe(1);
    const stats = calculateDashboardStats([weekdays], [], "week", parseISO("2026-08-19"));
    expect(stats.momentum).toBe(0);
    expect(stats.completionRate).toBe(0);
  });
});

describe("goal rules", () => {
  const goal: Goal = {
    id: "g",
    userId: "u",
    projectId: "p",
    projectCategories: ["Sport"],
    periodType: "week",
    targetMinutes: 600,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  it("measures a weekly goal over its week even when the page shows a single day", () => {
    const task: Task = {
      id: "t",
      userId: "u",
      title: "Séance",
      category: "General",
      projectId: "p",
      projectCategory: "Sport",
      recurrence: "DAILY",
      trackingType: "BOOLEAN",
      isActive: false,
      isArchived: false,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
    };
    const completions = ["2026-08-17", "2026-08-18"].map((date, i) => ({
      id: String(i),
      taskId: "t",
      userId: "u",
      date,
      completed: true,
      duration: 60,
      createdAt: "",
      updatedAt: "",
    }));
    const result = computeGoalProgress({
      goal,
      period: "day",
      referenceDate: parseISO("2026-08-19"),
      tasks: [task],
      completions,
    });
    expect(result.actualMinutes).toBe(120);
  });

  it("doesn't count external events outside the period when filtering by sub-category", () => {
    const result = computeGoalProgress({
      goal,
      period: "week",
      referenceDate: parseISO("2026-08-19"),
      tasks: [],
      completions: [],
      externalEvents: [
        { id: "in", title: "Sport", date: "2026-08-18", startTime: "10:00", endTime: "11:00", projectId: "p" } as unknown as ExternalCalendarEvent,
        { id: "out", title: "Sport", date: "2026-07-01", startTime: "10:00", endTime: "11:00", projectId: "p" } as unknown as ExternalCalendarEvent,
      ],
    });
    expect(result.actualMinutes).toBe(60);
  });
});

describe("all-projects board columns", () => {
  const board = [
    { id: "b-todo", label: "À faire" },
    { id: "b-review", label: "Revue" },
    { id: "b-done", label: "Terminé", isDone: true },
  ];
  const project = {
    columns: [
      { id: "p-backlog", label: "À faire" },
      { id: "p-review", label: "revue " },
      { id: "p-shipped", label: "Livré", isDone: true },
    ],
  };

  it("places a task by same name, done-to-done, else first column", () => {
    expect(resolveAllBoardColumnId({ projectId: "p", projectStatus: "p-review" }, board, project)).toBe("b-review");
    expect(resolveAllBoardColumnId({ projectId: "p", projectStatus: "p-shipped" }, board, project)).toBe("b-done");
    expect(resolveAllBoardColumnId({ projectId: "p", projectStatus: "p-backlog" }, board, project, true)).toBe("b-done");
    expect(resolveAllBoardColumnId({ projectId: null, projectStatus: "DONE" }, board, null)).toBe("b-done");
    expect(resolveAllBoardColumnId({ projectId: null, projectStatus: "TODO" }, board, null)).toBe("b-todo");
  });

  it("translates a drop back into the task's own project column", () => {
    expect(resolveStatusForAllBoardColumn({ projectId: "p" }, board[1], project)).toBe("p-review");
    expect(resolveStatusForAllBoardColumn({ projectId: "p" }, board[2], project)).toBe("p-shipped");
    expect(resolveStatusForAllBoardColumn({ projectId: null }, board[2], null)).toBe("DONE");
    // no equivalent column in the project: keeps the board column
    expect(resolveStatusForAllBoardColumn({ projectId: null }, board[1], null)).toBe("b-review");
  });
});

describe("carry-over of unfinished one-off tasks", () => {
  it("carries a timed one-off task to today, but not sleep entries nor finished tasks", async () => {
    const { computeTasksForDate } = await import("@/features/agenda/components/AgendaTimeline");
    const { format, subDays } = await import("date-fns");
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const base = {
      userId: "u",
      category: "General",
      recurrence: "ONCE" as const,
      trackingType: "BOOLEAN" as const,
      isActive: false,
      isArchived: false,
      createdAt: `${yesterday}T12:00:00.000Z`,
      updatedAt: `${yesterday}T12:00:00.000Z`,
    };
    const tasks = [
      { ...base, id: "timed", title: "Appeler le client", startTime: "10:00", endTime: "11:00" },
      { ...base, id: "sleep", title: "Sieste", startTime: "14:00", endTime: "14:30" },
      { ...base, id: "done", title: "Fait", startTime: "09:00", endTime: "10:00" },
    ];
    const completions = [
      { id: "c", taskId: "done", userId: "u", date: yesterday, completed: true, createdAt: "", updatedAt: "" },
    ];
    const ids = computeTasksForDate(today, tasks, completions).map((t) => t.id);
    expect(ids).toContain("timed");
    expect(ids).not.toContain("sleep");
    expect(ids).not.toContain("done");
  });
});
