import { describe, it, expect } from "vitest";
import { computeGoalProgress } from "./actions";
import { Goal } from "./types";
import { Task, TaskCompletion } from "@/features/tasks/types";

describe("computeGoalProgress", () => {
  const sampleGoal: Goal = {
    id: "goal_1",
    userId: "user_123",
    projectId: "proj_code",
    periodType: "day",
    periodKey: "2026-09-17",
    targetMinutes: 180, // 3h target
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const referenceDate = new Date("2026-09-17T12:00:00.000Z");

  it("should calculate exactly 1 minute when a repeated task has been started 1 minute ago (active running task)", () => {
    const oneMinuteAgoIso = new Date(Date.now() - 60 * 1000).toISOString();

    const activeRepeatedTask: Task = {
      id: "task_repeated_1",
      userId: "user_123",
      title: "Session Coding Répétée",
      category: "General",
      projectId: "proj_code",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 30, // Scheduled target is 30 mins, but only 1 min has elapsed
      isActive: true,
      startedAt: oneMinuteAgoIso,
      isArchived: false,
      createdAt: "2026-09-17T08:00:00.000Z",
      updatedAt: oneMinuteAgoIso,
    };

    const completions: TaskCompletion[] = [
      {
        id: "comp_1",
        userId: "user_123",
        taskId: "task_repeated_1",
        date: "2026-09-17",
        completed: false,
        actualStartTime: "16:16",
        actualEndTime: null,
        createdAt: "2026-09-17T16:16:00.000Z",
        updatedAt: "2026-09-17T16:16:00.000Z",
      },
    ];

    const result = computeGoalProgress({
      goal: sampleGoal,
      period: "day",
      referenceDate,
      tasks: [activeRepeatedTask],
      completions,
    });

    expect(result.actualMinutes).toBe(1);
    expect(result.formattedActual).toBe("1 min");
    expect(result.targetMinutes).toBe(180);
    expect(result.isCompleted).toBe(false);
    expect(result.formattedRemaining).toBe("2h 59m");
  });

  it("should calculate exact completed duration when task has recorded actual duration", () => {
    const task: Task = {
      id: "task_2",
      userId: "user_123",
      title: "Dev Feature X",
      category: "General",
      projectId: "proj_code",
      recurrence: "ONCE",
      trackingType: "DURATION",
      targetValue: 60,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: "2026-09-17T08:00:00.000Z",
      updatedAt: "2026-09-17T09:00:00.000Z",
    };

    const completions: TaskCompletion[] = [
      {
        id: "comp_2",
        userId: "user_123",
        taskId: "task_2",
        date: "2026-09-17",
        completed: true,
        duration: 45, // 45 minutes completed
        createdAt: "2026-09-17T09:00:00.000Z",
        updatedAt: "2026-09-17T09:00:00.000Z",
      },
    ];

    const result = computeGoalProgress({
      goal: sampleGoal,
      period: "day",
      referenceDate,
      tasks: [task],
      completions,
    });

    expect(result.actualMinutes).toBe(45);
    expect(result.formattedActual).toBe("45 min");
    expect(result.percentage).toBe(25);
  });

  it("should calculate exact duration from actualStartTime and actualEndTime", () => {
    const task: Task = {
      id: "task_3",
      userId: "user_123",
      title: "Review Code",
      category: "General",
      projectId: "proj_code",
      recurrence: "ONCE",
      trackingType: "DURATION",
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: "2026-09-17T08:00:00.000Z",
      updatedAt: "2026-09-17T11:15:00.000Z",
    };

    const completions: TaskCompletion[] = [
      {
        id: "comp_3",
        userId: "user_123",
        taskId: "task_3",
        date: "2026-09-17",
        completed: true,
        actualStartTime: "10:00",
        actualEndTime: "11:15", // 75 mins
        createdAt: "2026-09-17T11:15:00.000Z",
        updatedAt: "2026-09-17T11:15:00.000Z",
      },
    ];

    const result = computeGoalProgress({
      goal: sampleGoal,
      period: "day",
      referenceDate,
      tasks: [task],
      completions,
    });

    expect(result.actualMinutes).toBe(75);
    expect(result.formattedActual).toBe("1h 15m");
  });

  it("should return 0 minutes when a task is not active and not completed", () => {
    const task: Task = {
      id: "task_4",
      userId: "user_123",
      title: "Task in TODO",
      category: "General",
      projectId: "proj_code",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 60,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: "2026-09-17T08:00:00.000Z",
      updatedAt: "2026-09-17T08:00:00.000Z",
    };

    const result = computeGoalProgress({
      goal: sampleGoal,
      period: "day",
      referenceDate,
      tasks: [task],
      completions: [],
    });

    expect(result.actualMinutes).toBe(0);
    expect(result.formattedActual).toBe("0 min");
    expect(result.percentage).toBe(0);
  });

  it("should keep repeated task time strictly independent per day (e.g. 2h16 yesterday vs 1 min today)", () => {
    const oneMinuteAgoIso = new Date(Date.now() - 60 * 1000).toISOString();

    const recurringTask: Task = {
      id: "task_repeated_daily",
      userId: "user_123",
      title: "Routine Quotidienne Code",
      category: "General",
      projectId: "proj_code",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 60,
      isActive: true,
      startedAt: oneMinuteAgoIso, // Started 1 minute ago today
      isArchived: false,
      createdAt: "2026-09-10T08:00:00.000Z",
      updatedAt: oneMinuteAgoIso,
    };

    // Completions: Yesterday had 2h16 (136 min) recorded, today is active 1 min
    const completions: TaskCompletion[] = [
      {
        id: "comp_yesterday",
        userId: "user_123",
        taskId: "task_repeated_daily",
        date: "2026-09-16", // Yesterday
        completed: true,
        duration: 136, // 2h16
        actualStartTime: "10:00",
        actualEndTime: "12:16",
        createdAt: "2026-09-16T12:16:00.000Z",
        updatedAt: "2026-09-16T12:16:00.000Z",
      },
      {
        id: "comp_today",
        userId: "user_123",
        taskId: "task_repeated_daily",
        date: "2026-09-17", // Today
        completed: false,
        actualStartTime: "16:20",
        actualEndTime: null,
        createdAt: "2026-09-17T16:20:00.000Z",
        updatedAt: "2026-09-17T16:20:00.000Z",
      },
    ];

    // Today's progress (Day view for 2026-09-17)
    const todayResult = computeGoalProgress({
      goal: sampleGoal,
      period: "day",
      referenceDate: new Date("2026-09-17T12:00:00.000Z"),
      tasks: [recurringTask],
      completions,
    });

    expect(todayResult.actualMinutes).toBe(1);
    expect(todayResult.formattedActual).toBe("1 min");

    // Yesterday's progress (Day view for 2026-09-16)
    const yesterdayResult = computeGoalProgress({
      goal: sampleGoal,
      period: "day",
      referenceDate: new Date("2026-09-16T12:00:00.000Z"),
      tasks: [recurringTask],
      completions,
    });

    expect(yesterdayResult.actualMinutes).toBe(136);
    expect(yesterdayResult.formattedActual).toBe("2h 16m");

    // Week progress (Week view containing both days)
    const weekResult = computeGoalProgress({
      goal: sampleGoal,
      period: "week",
      referenceDate: new Date("2026-09-17T12:00:00.000Z"),
      tasks: [recurringTask],
      completions,
    });

    expect(weekResult.actualMinutes).toBe(137); // 136 + 1
    expect(weekResult.formattedActual).toBe("2h 17m");
  });
});
