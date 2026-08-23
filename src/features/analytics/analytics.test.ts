import { describe, it, expect } from "vitest";
import {
  calculateCurrentStreak,
  calculateBestStreak,
  calculateDashboardStats,
  TaskRecord,
  CompletionRecord,
} from "./calculations";
import { parseISO } from "date-fns";

describe("Analytics Calculations", () => {
  it("calculates current streak accurately", () => {
    const referenceDate = parseISO("2026-08-23");
    const completions: CompletionRecord[] = [
      { id: "1", taskId: "t1", date: "2026-08-23", completed: true },
      { id: "2", taskId: "t1", date: "2026-08-22", completed: true },
      { id: "3", taskId: "t1", date: "2026-08-21", completed: true },
      { id: "4", taskId: "t1", date: "2026-08-20", completed: true },
      { id: "5", taskId: "t1", date: "2026-08-18", completed: true }, // gap on 19th
    ];

    const streak = calculateCurrentStreak(completions, referenceDate);
    expect(streak).toBe(4);
  });

  it("calculates best streak accurately across gaps", () => {
    const completions: CompletionRecord[] = [
      { id: "1", taskId: "t1", date: "2026-08-01", completed: true },
      { id: "2", taskId: "t1", date: "2026-08-02", completed: true },
      { id: "3", taskId: "t1", date: "2026-08-03", completed: true },
      { id: "4", taskId: "t1", date: "2026-08-04", completed: true },
      { id: "5", taskId: "t1", date: "2026-08-05", completed: true }, // 5-day streak
      { id: "6", taskId: "t1", date: "2026-08-10", completed: true },
      { id: "7", taskId: "t1", date: "2026-08-11", completed: true },
    ];

    const bestStreak = calculateBestStreak(completions);
    expect(bestStreak).toBe(5);
  });

  it("generates 7-point momentum history and dashboard stats", () => {
    const referenceDate = parseISO("2026-08-23");
    const tasks: TaskRecord[] = [
      {
        id: "t1",
        title: "Push-ups",
        category: "Fitness",
        recurrence: "DAILY",
        trackingType: "NUMBER",
        targetValue: 50,
      },
    ];
    const completions: CompletionRecord[] = [
      { id: "1", taskId: "t1", date: "2026-08-23", completed: true },
      { id: "2", taskId: "t1", date: "2026-08-22", completed: true },
    ];

    const stats = calculateDashboardStats(tasks, completions, "week", referenceDate);
    expect(stats.momentumHistory.length).toBe(7);
    expect(stats.last7DaysStatus.length).toBe(7);
    expect(stats.currentStreak).toBe(2);
  });
});
