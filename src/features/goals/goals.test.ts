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

  it("should accumulate earlier completed session today (iteration 1) with current active running session (iteration 2)", () => {
    const oneMinuteAgoIso = new Date(Date.now() - 60 * 1000).toISOString();

    const recurringTask: Task = {
      id: "task_repeated_multisession",
      userId: "user_123",
      title: "Routine Sport / Travail",
      category: "General",
      projectId: "proj_code",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 60,
      isActive: true,
      startedAt: oneMinuteAgoIso, // Started session 2, 1 minute ago
      isArchived: false,
      createdAt: "2026-09-17T08:00:00.000Z",
      updatedAt: oneMinuteAgoIso,
    };

    // Session 1 was completed earlier today for 30 minutes
    const completions: TaskCompletion[] = [
      {
        id: "comp_session_1",
        userId: "user_123",
        taskId: "task_repeated_multisession",
        date: "2026-09-17",
        completed: true,
        duration: 30, // 30 minutes done in session 1
        actualStartTime: "09:00",
        actualEndTime: "09:30",
        createdAt: "2026-09-17T09:30:00.000Z",
        updatedAt: "2026-09-17T09:30:00.000Z",
      },
    ];

    const result = computeGoalProgress({
      goal: sampleGoal,
      period: "day",
      referenceDate: new Date("2026-09-17T12:00:00.000Z"),
      tasks: [recurringTask],
      completions,
    });

    // 30 min from session 1 + 1 min from active session 2 = 31 min
    expect(result.actualMinutes).toBe(31);
    expect(result.formattedActual).toBe("31 min");
  });

  describe("Count-based goals (targetType: 'count')", () => {
    const sportGoal: Goal = {
      id: "goal_sport_weekly",
      userId: "user_123",
      projectId: "proj_sport",
      periodType: "week",
      periodKey: "week_2026-09-15",
      targetType: "count",
      targetCount: 2,
      unit: "séance",
      targetMinutes: 0,
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    };

    const sportTask: Task = {
      id: "task_sport_1",
      userId: "user_123",
      title: "Séance Musculation / Cardio",
      category: "General",
      projectId: "proj_sport",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 45,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-15T08:00:00.000Z",
    };

    it("should return 0 séances when no sessions are completed during the week", () => {
      const result = computeGoalProgress({
        goal: sportGoal,
        period: "week",
        referenceDate: new Date("2026-09-17T12:00:00.000Z"),
        tasks: [sportTask],
        completions: [],
      });

      expect(result.targetType).toBe("count");
      expect(result.actualCount).toBe(0);
      expect(result.targetCount).toBe(2);
      expect(result.percentage).toBe(0);
      expect(result.formattedActual).toBe("0 séance");
      expect(result.formattedTarget).toBe("2 séances");
      expect(result.formattedRemaining).toBe("2 séances");
      expect(result.isCompleted).toBe(false);
      expect(result.isOverachieved).toBe(false);
    });

    it("should calculate 50% and 1 séance remaining when 1 session is completed", () => {
      const completions: TaskCompletion[] = [
        {
          id: "comp_sport_tuesday",
          userId: "user_123",
          taskId: "task_sport_1",
          date: "2026-09-15",
          completed: true,
          duration: 50,
          createdAt: "2026-09-15T18:00:00.000Z",
          updatedAt: "2026-09-15T18:50:00.000Z",
        },
      ];

      const result = computeGoalProgress({
        goal: sportGoal,
        period: "week",
        referenceDate: new Date("2026-09-17T12:00:00.000Z"),
        tasks: [sportTask],
        completions,
      });

      expect(result.targetType).toBe("count");
      expect(result.actualCount).toBe(1);
      expect(result.targetCount).toBe(2);
      expect(result.percentage).toBe(50);
      expect(result.formattedActual).toBe("1 séance");
      expect(result.formattedTarget).toBe("2 séances");
      expect(result.formattedRemaining).toBe("1 séance");
      expect(result.isCompleted).toBe(false);
    });

    it("should mark goal as 100% completed when 2 sessions are completed in the week", () => {
      const completions: TaskCompletion[] = [
        {
          id: "comp_sport_tuesday",
          userId: "user_123",
          taskId: "task_sport_1",
          date: "2026-09-15",
          completed: true,
          duration: 50,
          createdAt: "2026-09-15T18:00:00.000Z",
          updatedAt: "2026-09-15T18:50:00.000Z",
        },
        {
          id: "comp_sport_thursday",
          userId: "user_123",
          taskId: "task_sport_1",
          date: "2026-09-17",
          completed: true,
          duration: 60,
          createdAt: "2026-09-17T17:00:00.000Z",
          updatedAt: "2026-09-17T18:00:00.000Z",
        },
      ];

      const result = computeGoalProgress({
        goal: sportGoal,
        period: "week",
        referenceDate: new Date("2026-09-17T12:00:00.000Z"),
        tasks: [sportTask],
        completions,
      });

      expect(result.actualCount).toBe(2);
      expect(result.targetCount).toBe(2);
      expect(result.percentage).toBe(100);
      expect(result.formattedActual).toBe("2 séances");
      expect(result.formattedTarget).toBe("2 séances");
      expect(result.formattedRemaining).toBe("0 séance");
      expect(result.isCompleted).toBe(true);
      expect(result.isOverachieved).toBe(false);
    });

    it("should handle custom unit like 'fois' and overachievement correctly", () => {
      const customGoal: Goal = {
        ...sportGoal,
        unit: "fois",
        targetCount: 2,
      };

      const completions: TaskCompletion[] = [
        {
          id: "comp_1",
          userId: "user_123",
          taskId: "task_sport_1",
          date: "2026-09-15",
          completed: true,
          duration: 40,
          createdAt: "2026-09-15T18:00:00.000Z",
          updatedAt: "2026-09-15T18:40:00.000Z",
        },
        {
          id: "comp_2",
          userId: "user_123",
          taskId: "task_sport_1",
          date: "2026-09-16",
          completed: true,
          duration: 45,
          createdAt: "2026-09-16T18:00:00.000Z",
          updatedAt: "2026-09-16T18:45:00.000Z",
        },
        {
          id: "comp_3",
          userId: "user_123",
          taskId: "task_sport_1",
          date: "2026-09-17",
          completed: true,
          duration: 50,
          createdAt: "2026-09-17T18:00:00.000Z",
          updatedAt: "2026-09-17T18:50:00.000Z",
        },
      ];

      const result = computeGoalProgress({
        goal: customGoal,
        period: "week",
        referenceDate: new Date("2026-09-17T12:00:00.000Z"),
        tasks: [sportTask],
        completions,
      });

      expect(result.actualCount).toBe(3);
      expect(result.targetCount).toBe(2);
      expect(result.percentage).toBe(150);
      expect(result.formattedActual).toBe("3 fois");
      expect(result.formattedTarget).toBe("2 fois");
      expect(result.isCompleted).toBe(true);
      expect(result.isOverachieved).toBe(true);
    });
  });

  describe("Multi-subproject goals (projectCategories: string[])", () => {
    const multiSubprojectGoal: Goal = {
      id: "goal_multi_sub",
      userId: "user_123",
      projectId: "proj_fitness",
      projectCategories: ["Musculation", "Cardio"],
      periodType: "week",
      periodKey: "week_2026-09-15",
      targetType: "count",
      targetCount: 3,
      unit: "séance",
      targetMinutes: 0,
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    };

    const taskMuscu: Task = {
      id: "task_muscu",
      userId: "user_123",
      title: "Séance Pectoraux",
      category: "Musculation",
      projectCategory: "Musculation",
      projectId: "proj_fitness",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 60,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-15T08:00:00.000Z",
    };

    const taskCardio: Task = {
      id: "task_cardio",
      userId: "user_123",
      title: "Running 10km",
      category: "Cardio",
      projectCategory: "Cardio",
      projectId: "proj_fitness",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 45,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-15T08:00:00.000Z",
    };

    const taskNutrition: Task = {
      id: "task_nutrition",
      userId: "user_123",
      title: "Meal Prep",
      category: "Nutrition",
      projectCategory: "Nutrition",
      projectId: "proj_fitness",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 30,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-15T08:00:00.000Z",
    };

    it("should aggregate completed sessions from all targeted sub-projects and ignore other sub-projects", () => {
      const completions: TaskCompletion[] = [
        {
          id: "comp_muscu_1",
          userId: "user_123",
          taskId: "task_muscu",
          date: "2026-09-15",
          completed: true,
          duration: 60,
          createdAt: "2026-09-15T18:00:00.000Z",
          updatedAt: "2026-09-15T19:00:00.000Z",
        },
        {
          id: "comp_cardio_1",
          userId: "user_123",
          taskId: "task_cardio",
          date: "2026-09-16",
          completed: true,
          duration: 45,
          createdAt: "2026-09-16T18:00:00.000Z",
          updatedAt: "2026-09-16T18:45:00.000Z",
        },
        {
          id: "comp_nutrition_1",
          userId: "user_123",
          taskId: "task_nutrition", // Should NOT count towards Musculation + Cardio goal
          date: "2026-09-17",
          completed: true,
          duration: 30,
          createdAt: "2026-09-17T18:00:00.000Z",
          updatedAt: "2026-09-17T18:30:00.000Z",
        },
      ];

      const result = computeGoalProgress({
        goal: multiSubprojectGoal,
        period: "week",
        referenceDate: new Date("2026-09-17T12:00:00.000Z"),
        tasks: [taskMuscu, taskCardio, taskNutrition],
        completions,
      });

      // Musculation (1) + Cardio (1) = 2, Nutrition (1) ignored
      expect(result.actualCount).toBe(2);
      expect(result.targetCount).toBe(3);
      expect(result.percentage).toBe(67);
      expect(result.formattedActual).toBe("2 séances");
      expect(result.formattedRemaining).toBe("1 séance");
      expect(result.isCompleted).toBe(false);
    });

    it("should correctly compute duration progress across multiple sub-projects", () => {
      const durationGoal: Goal = {
        id: "goal_multi_duration",
        userId: "user_123",
        projectId: "proj_fitness",
        projectCategories: ["Musculation", "Cardio"],
        periodType: "week",
        periodKey: "week_2026-09-15",
        targetType: "duration",
        targetMinutes: 120, // 2h target
        createdAt: "2026-09-15T00:00:00.000Z",
        updatedAt: "2026-09-15T00:00:00.000Z",
      };

      const completions: TaskCompletion[] = [
        {
          id: "comp_muscu_1",
          userId: "user_123",
          taskId: "task_muscu",
          date: "2026-09-15",
          completed: true,
          duration: 60,
          createdAt: "2026-09-15T18:00:00.000Z",
          updatedAt: "2026-09-15T19:00:00.000Z",
        },
        {
          id: "comp_cardio_1",
          userId: "user_123",
          taskId: "task_cardio",
          date: "2026-09-16",
          completed: true,
          duration: 60,
          createdAt: "2026-09-16T18:00:00.000Z",
          updatedAt: "2026-09-16T19:00:00.000Z",
        },
        {
          id: "comp_nutrition_1",
          userId: "user_123",
          taskId: "task_nutrition",
          date: "2026-09-17",
          completed: true,
          duration: 40, // Should NOT count
          createdAt: "2026-09-17T18:00:00.000Z",
          updatedAt: "2026-09-17T18:40:00.000Z",
        },
      ];

      const result = computeGoalProgress({
        goal: durationGoal,
        period: "week",
        referenceDate: new Date("2026-09-17T12:00:00.000Z"),
        tasks: [taskMuscu, taskCardio, taskNutrition],
        completions,
      });

      // 60 min (Muscu) + 60 min (Cardio) = 120 min = 2h
      expect(result.actualMinutes).toBe(120);
      expect(result.formattedActual).toBe("2h");
      expect(result.percentage).toBe(100);
      expect(result.isCompleted).toBe(true);
      expect(result.formattedRemaining).toBe("0 min");
    });
  });
});
