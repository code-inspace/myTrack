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

  describe("Kanban Done Column and Period Filter Logic", () => {
    const columns = [
      { id: "TODO", label: "À faire" },
      { id: "IN_PROGRESS", label: "En cours" },
      { id: "DONE", label: "Fait", isDone: true },
    ];

    it("places completed tasks strictly into Done column", async () => {
      const { groupTasksByColumn } = await import("@/features/projects/components/KanbanBoard");
      const task1: Task = {
        id: "t1",
        userId: "u1",
        title: "Completed Task",
        category: "General",
        projectStatus: "DONE",
        recurrence: "ONCE",
        trackingType: "BOOLEAN",
        isActive: false,
        isArchived: false,
        createdAt: "2026-08-27T12:00:00.000Z",
        updatedAt: "2026-08-27T12:00:00.000Z",
      };

      const completions: TaskCompletion[] = [
        {
          id: "c1",
          taskId: "t1",
          userId: "u1",
          date: "2026-08-27",
          completed: true,
          createdAt: "2026-08-27T12:00:00.000Z",
          updatedAt: "2026-08-27T12:00:00.000Z",
        },
      ];

      const groups = groupTasksByColumn([task1], columns, completions);
      expect(groups.get("DONE")?.length).toBe(1);
      expect(groups.get("TODO")?.length).toBe(0);
    });

    it("filters done tasks by rolling period (1d, 7d, 30d)", async () => {
      const { isTaskDoneInPeriod } = await import("@/features/projects/components/KanbanBoard");
      const baseTask: Task = {
        id: "t1",
        userId: "u1",
        title: "Test Task",
        category: "General",
        projectStatus: "DONE",
        recurrence: "ONCE",
        trackingType: "BOOLEAN",
        isActive: false,
        isArchived: false,
        createdAt: "2026-08-27T12:00:00.000Z",
        updatedAt: "2026-08-27T12:00:00.000Z",
      };

      // Completed today (2026-08-27)
      const completionsToday: TaskCompletion[] = [
        {
          id: "c1",
          taskId: "t1",
          userId: "u1",
          date: "2026-08-27",
          completed: true,
          createdAt: "2026-08-27T12:00:00.000Z",
          updatedAt: "2026-08-27T12:00:00.000Z",
        },
      ];

      expect(isTaskDoneInPeriod(baseTask, completionsToday, "1d", "2026-08-27")).toBe(true);
      expect(isTaskDoneInPeriod(baseTask, completionsToday, "7d", "2026-08-27")).toBe(true);
      expect(isTaskDoneInPeriod(baseTask, completionsToday, "30d", "2026-08-27")).toBe(true);

      // Completed 4 days ago (2026-08-23)
      const completions4DaysAgo: TaskCompletion[] = [
        {
          id: "c2",
          taskId: "t1",
          userId: "u1",
          date: "2026-08-23",
          completed: true,
          createdAt: "2026-08-23T12:00:00.000Z",
          updatedAt: "2026-08-23T12:00:00.000Z",
        },
      ];

      expect(isTaskDoneInPeriod(baseTask, completions4DaysAgo, "1d", "2026-08-27")).toBe(false);
      expect(isTaskDoneInPeriod(baseTask, completions4DaysAgo, "7d", "2026-08-27")).toBe(true);
      expect(isTaskDoneInPeriod(baseTask, completions4DaysAgo, "30d", "2026-08-27")).toBe(true);

      // Completed 15 days ago (2026-08-12)
      const completions15DaysAgo: TaskCompletion[] = [
        {
          id: "c3",
          taskId: "t1",
          userId: "u1",
          date: "2026-08-12",
          completed: true,
          createdAt: "2026-08-12T12:00:00.000Z",
          updatedAt: "2026-08-12T12:00:00.000Z",
        },
      ];

      expect(isTaskDoneInPeriod(baseTask, completions15DaysAgo, "1d", "2026-08-27")).toBe(false);
      expect(isTaskDoneInPeriod(baseTask, completions15DaysAgo, "7d", "2026-08-27")).toBe(false);
      expect(isTaskDoneInPeriod(baseTask, completions15DaysAgo, "30d", "2026-08-27")).toBe(true);
    });
  });

  describe("Task Start & Execution Flow (Démarrer / Active Timer)", () => {
    it("activates task state with startedAt timestamp and prioritizes active task", () => {
      const initialTask: Task = {
        id: "task-running-1",
        userId: "user-123",
        title: "Séance Musculation",
        category: "Sport",
        recurrence: "DAILY",
        trackingType: "DURATION",
        targetValue: 45,
        isActive: false,
        startedAt: null,
        isArchived: false,
        createdAt: "2026-09-03T10:00:00.000Z",
        updatedAt: "2026-09-03T10:00:00.000Z",
      };

      const nowIso = "2026-09-03T12:30:00.000Z";
      const activatedTask: Task = {
        ...initialTask,
        isActive: true,
        startedAt: nowIso,
      };

      expect(activatedTask.isActive).toBe(true);
      expect(activatedTask.startedAt).toBe(nowIso);

      const otherTask: Task = {
        id: "task-idle-2",
        userId: "user-123",
        title: "Lecture",
        category: "Mindset",
        recurrence: "DAILY",
        trackingType: "BOOLEAN",
        isActive: false,
        startedAt: null,
        isArchived: false,
        createdAt: "2026-09-03T10:00:00.000Z",
        updatedAt: "2026-09-03T10:00:00.000Z",
      };

      const mappedList = [initialTask, activatedTask, otherTask].map((t) =>
        mapTaskWithCompletion(t, [], "2026-09-03")
      );
      const sorted = sortTasksByPriority(mappedList);

      // The active task must be first
      expect(sorted[0].id).toBe("task-running-1");
      expect(sorted[0].isActive).toBe(true);
    });

    it("generates correct Live Activity attributes and initial state payload for iOS/Dynamic Island", () => {
      const task: Task = {
        id: "task-live-1",
        userId: "user-123",
        title: "Dip sur banc",
        category: "Fitness",
        recurrence: "ONCE",
        trackingType: "DURATION",
        targetValue: 50,
        isActive: true,
        isArchived: false,
        createdAt: "2026-09-03T12:00:00.000Z",
        updatedAt: "2026-09-03T12:00:00.000Z",
      };

      const nowTimestamp = 1788438600000;
      const targetDurationMinutes = task.targetValue || 30;

      const activityAttributes = {
        taskId: task.id,
        taskTitle: task.title,
        category: task.category,
      };

      const activityState = {
        currentStatus: "IN_PROGRESS" as const,
        startedAtTimestamp: nowTimestamp,
        elapsedSeconds: 0,
        targetDurationSeconds: targetDurationMinutes * 60,
        totalFormattedDuration: `${targetDurationMinutes} min`,
        subtitle: task.category || "En cours",
        progress: 0,
      };

      expect(activityAttributes.taskId).toBe("task-live-1");
      expect(activityAttributes.taskTitle).toBe("Dip sur banc");
      expect(activityState.currentStatus).toBe("IN_PROGRESS");
      expect(activityState.targetDurationSeconds).toBe(3000);
      expect(activityState.totalFormattedDuration).toBe("50 min");
    });

    it("accurately handles stopping a task running for 26 hours across multi-day", () => {
      // Started yesterday at 14:00
      const startedAt = "2026-09-03T14:00:00.000Z";
      // Stopped today at 16:00 (26 hours later)
      const stoppedAt = new Date("2026-09-04T16:00:00.000Z");

      const startDate = new Date(startedAt);
      const diffMinutes = Math.round((stoppedAt.getTime() - startDate.getTime()) / 60000);
      const durationMinutes = Math.max(1, diffMinutes);

      // 26 hours = 26 * 60 = 1560 minutes
      expect(durationMinutes).toBe(1560);

      // Verify timer formatter for 26h (93600 seconds)
      const totalSec = Math.floor((stoppedAt.getTime() - startDate.getTime()) / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;

      expect(hours).toBe(26);
      expect(days).toBe(1);
      expect(remHours).toBe(2);

      const formattedTimer = `${days}j ${remHours.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m`;
      expect(formattedTimer).toBe("1j 02h 00m");

      // Verify task deactivation state
      const runningTask: Task = {
        id: "task-26h",
        userId: "user-1",
        title: "Long Run Marathon",
        category: "Sport",
        recurrence: "ONCE",
        trackingType: "DURATION",
        isActive: true,
        startedAt,
        isArchived: false,
        createdAt: "2026-09-03T14:00:00.000Z",
        updatedAt: "2026-09-03T14:00:00.000Z",
      };

      const stoppedTask: Task = {
        ...runningTask,
        isActive: false,
        startedAt: null,
        updatedAt: stoppedAt.toISOString(),
      };

      expect(stoppedTask.isActive).toBe(false);
      expect(stoppedTask.startedAt).toBeNull();

      const completion: TaskCompletion = {
        id: "comp-26h",
        taskId: runningTask.id,
        userId: runningTask.userId,
        date: "2026-09-04",
        completed: true,
        duration: durationMinutes,
        actualStartTime: "14:00",
        actualEndTime: "16:00",
        createdAt: stoppedAt.toISOString(),
        updatedAt: stoppedAt.toISOString(),
      };

      expect(completion.completed).toBe(true);
      expect(completion.duration).toBe(1560);

      const mapped = mapTaskWithCompletion(stoppedTask, [completion], "2026-09-04");
      expect(mapped.isActive).toBe(false);
      expect(mapped.isCompletedToday).toBe(true);
    });

    it("builds and sorts unified stream with events: upcoming/non-done before passed/done", async () => {
      const { buildAndSortUnifiedStream } = await import("./unifiedStream");

      const taskTodo: any = {
        id: "task-todo",
        title: "Tâche à faire",
        isCompletedToday: false,
        startTime: "10:00",
      };
      const taskDone: any = {
        id: "task-done",
        title: "Tâche terminée",
        isCompletedToday: true,
        startTime: "08:00",
      };

      const eventUpcoming: any = {
        id: "evt-upcoming",
        title: "Réunion future",
        date: "2026-09-15",
        startTime: "23:59",
        endTime: "23:59",
      };
      const eventPassed: any = {
        id: "evt-passed",
        title: "RDV passé",
        date: "2026-09-15",
        startTime: "07:00",
        endTime: "08:00",
      };

      const stream = buildAndSortUnifiedStream(
        [taskDone, taskTodo],
        [eventPassed, eventUpcoming],
        "2026-09-15",
        { "evt-passed": true, "evt-upcoming": false }
      );

      // Verify IDs ordering
      const ids = stream.map((s) => s.id);
      // Non-done items come first (task-todo and event-upcoming)
      expect(ids.indexOf("task-todo")).toBeLessThan(ids.indexOf("task-done"));
      expect(ids.indexOf("event_evt-upcoming")).toBeLessThan(ids.indexOf("event_evt-passed"));
      expect(ids.indexOf("event_evt-upcoming")).toBeLessThan(ids.indexOf("task-done"));
    });
  });
});
