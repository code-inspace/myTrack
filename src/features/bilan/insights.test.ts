import { describe, it, expect } from "vitest";
import {
  goalPace,
  goalsVerdict,
  sortByRisk,
  periodElapsedFraction,
  timeDeltas,
  habitsAtRisk,
  plannedVsDone,
  sleepRegularity,
  focusByHour,
  NO_PROJECT_KEY,
  type GoalInsightItem,
} from "./insights";
import type { GoalProgressResult } from "@/features/goals/types";
import type { Task, TaskCompletion } from "@/features/tasks/types";
import type { HabitStreakStat } from "@/features/analytics/types";
import type { DailySleepLog } from "@/features/sleep/types";

// Wednesday 2026-11-04, 14:00 local
const WED_14 = new Date(2026, 10, 4, 14, 0, 0);

const progress = (over: Partial<GoalProgressResult> = {}): GoalProgressResult => ({
  targetType: "duration",
  actualMinutes: 0,
  targetMinutes: 600,
  percentage: 0,
  isCompleted: false,
  isOverachieved: false,
  formattedActual: "",
  formattedTarget: "",
  formattedRemaining: "",
  ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "t",
  userId: "u",
  title: "Tâche",
  category: "General",
  recurrence: "ONCE",
  trackingType: "BOOLEAN",
  isActive: false,
  isArchived: false,
  createdAt: "2026-11-04T12:00:00.000Z",
  updatedAt: "2026-11-04T12:00:00.000Z",
  ...over,
});

const completion = (over: Partial<TaskCompletion> = {}): TaskCompletion => ({
  id: "c",
  taskId: "t",
  userId: "u",
  date: "2026-11-04",
  completed: true,
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("goal pace", () => {
  it("knows how much of the week is behind us", () => {
    const f = periodElapsedFraction("week", WED_14, WED_14);
    // Mon + Tue done, Wednesday ~44% through the waking day, out of 7 days
    expect(f).toBeGreaterThan(0.3);
    expect(f).toBeLessThan(0.4);
    expect(periodElapsedFraction("week", WED_14, new Date(2026, 10, 12))).toBe(1);
    expect(periodElapsedFraction("week", new Date(2026, 10, 18), WED_14)).toBe(0);
  });

  it("says ahead / on track / behind against where you should be", () => {
    const goal = { periodType: "week" as const, targetType: "duration" as const };
    expect(goalPace(goal, progress({ percentage: 60, actualMinutes: 360 }), WED_14, WED_14).status).toBe("ahead");
    expect(goalPace(goal, progress({ percentage: 33, actualMinutes: 200 }), WED_14, WED_14).status).toBe("on_track");
    expect(goalPace(goal, progress({ percentage: 10, actualMinutes: 60 }), WED_14, WED_14).status).toBe("behind");
    expect(goalPace(goal, progress({ percentage: 100, isCompleted: true }), WED_14, WED_14).status).toBe("done");
  });

  it("computes what is left per remaining day, and a missed goal once the period is over", () => {
    const goal = { periodType: "week" as const, targetType: "duration" as const };
    const pace = goalPace(goal, progress({ percentage: 10, actualMinutes: 60 }), WED_14, WED_14);
    expect(pace.remaining).toBe(540);
    expect(pace.daysLeft).toBe(5); // Wed → Sun
    expect(pace.perDay).toBe(108);
    const over = goalPace(goal, progress({ percentage: 40, actualMinutes: 240 }), WED_14, new Date(2026, 10, 12));
    expect(over.status).toBe("missed");
  });

  it("sorts the riskiest first", () => {
    const mk = (id: string, status: "behind" | "ahead" | "done", pct: number) => ({
      id,
      pace: { status } as never,
      progress: progress({ percentage: pct }),
    });
    const order = sortByRisk([mk("done", "done", 100), mk("ahead", "ahead", 70), mk("behind", "behind", 5)]).map((i) => i.id);
    expect(order).toEqual(["behind", "ahead", "done"]);
  });
});

describe("goals verdict", () => {
  const item = (goalId: string, status: GoalInsightItem["pace"]["status"], remaining: number, perDay: number | null): GoalInsightItem => ({
    goalId,
    name: goalId,
    targetType: "duration",
    pace: { status, expectedPercent: 50, remaining, perDay, daysLeft: 3, isCount: false },
  });

  it("counts goals on track and picks the biggest gap among the late ones", () => {
    const v = goalsVerdict([item("postulation", "behind", 90, 30), item("revision", "behind", 200, 70), item("sport", "ahead", 30, 10), item("lecture", "done", 0, 0)]);
    expect(v).toMatchObject({ total: 4, done: 1, onTrack: 2, behind: 2 });
    expect(v.focus).toMatchObject({ goalId: "revision", remainingMinutes: 200, behind: true });
    expect(v.focus?.suggestedMinutes).toBe(75); // 70 min/day rounded up to 15
  });

  it("suggests at least 30 minutes and never more than what is left", () => {
    expect(goalsVerdict([item("a", "behind", 20, 5)]).focus?.suggestedMinutes).toBe(30);
    expect(goalsVerdict([item("b", "behind", 100, 400)]).focus?.suggestedMinutes).toBe(105);
  });

  it("has no focus when everything is fine", () => {
    expect(goalsVerdict([item("a", "ahead", 10, 5), item("b", "done", 0, 0)]).focus).toBeNull();
  });
});

describe("time per project", () => {
  it("totals completed minutes per project and compares with the previous week", () => {
    const tasks = [task({ id: "a", projectId: "p1" }), task({ id: "b", projectId: "p2" }), task({ id: "c" })];
    const completions = [
      completion({ taskId: "a", date: "2026-11-03", duration: 90 }),
      completion({ taskId: "a", date: "2026-10-28", duration: 60 }), // previous week
      completion({ taskId: "b", date: "2026-11-04", duration: 30 }),
      completion({ taskId: "c", date: "2026-11-04", duration: 20 }),
      completion({ taskId: "a", date: "2026-11-04", duration: 40, completed: false }), // not done: ignored
    ];
    const r = timeDeltas({ tasks, completions }, "week", WED_14);
    expect(r.totalMinutes).toBe(140);
    expect(r.previousTotalMinutes).toBe(60);
    expect(r.rows[0]).toEqual({ key: "p1", minutes: 90, previousMinutes: 60, deltaMinutes: 30 });
    expect(r.rows.find((x) => x.key === NO_PROJECT_KEY)?.minutes).toBe(20);
  });
});

describe("habits at risk", () => {
  const habit = (over: Partial<HabitStreakStat>): HabitStreakStat => ({
    taskId: "h",
    taskTitle: "Sport",
    category: "General",
    currentStreak: 4,
    bestStreak: 6,
    completionRate7Days: 80,
    rolling7Days: [{ date: "2026-11-04", dayName: "Mer", isScheduled: true, isCompleted: false }],
    ...over,
  });

  it("flags scheduled, undone habits that have a streak to lose", () => {
    const risk = habitsAtRisk(
      [habit({}), habit({ taskId: "x", currentStreak: 0 }), habit({ taskId: "y", rolling7Days: [{ date: "2026-11-04", dayName: "Mer", isScheduled: true, isCompleted: true }] })],
      WED_14,
    );
    expect(risk).toEqual([{ taskId: "h", title: "Sport", streak: 4 }]);
  });
});

describe("planned vs done", () => {
  it("rates what was planned, and counts the tasks still waiting from earlier days", () => {
    const tasks = [
      task({ id: "a", createdAt: "2026-11-02T12:00:00.000Z" }), // Mon, done
      task({ id: "b", createdAt: "2026-11-03T12:00:00.000Z" }), // Tue, never done → carried over
      task({ id: "c", createdAt: "2026-11-04T12:00:00.000Z" }), // today, not done
    ];
    const completions = [completion({ taskId: "a", date: "2026-11-02" })];
    const r = plannedVsDone({ tasks, completions }, "week", WED_14, WED_14);
    expect(r).toEqual({ planned: 3, done: 1, rate: 33, carriedOver: 1 });
  });
});

describe("sleep regularity", () => {
  /** One log per date, like the app stores them: that evening's bedtime and that morning's wake-up. */
  const logsFrom = (nights: Array<[string, string, string]>): DailySleepLog[] => {
    const byDate = new Map<string, DailySleepLog>();
    const get = (date: string) => byDate.get(date) || byDate.set(date, { date }).get(date)!;
    for (const [bedDate, bed, wake] of nights) {
      const wakeDate = new Date(`${bedDate}T12:00:00`);
      wakeDate.setDate(wakeDate.getDate() + 1);
      const wakeKey = `${wakeDate.getFullYear()}-${String(wakeDate.getMonth() + 1).padStart(2, "0")}-${String(wakeDate.getDate()).padStart(2, "0")}`;
      // An after-midnight bedtime is stored on the wake-up day, an evening one on the evening
      const bedKey = Number(bed.split(":")[0]) < 12 ? wakeKey : bedDate;
      Object.assign(get(bedKey), { bedtime: bed, bedtimeValidated: true });
      Object.assign(get(wakeKey), { wakeTime: wake, wakeTimeValidated: true });
    }
    return Array.from(byDate.values());
  };

  it("is very regular when bed and wake times barely move, with the average duration", () => {
    const logs = logsFrom([
      ["2026-11-03", "23:00", "07:00"],
      ["2026-11-02", "23:10", "07:05"],
      ["2026-11-01", "22:55", "06:55"],
      ["2026-10-31", "23:05", "07:00"],
    ]);
    const r = sleepRegularity(logs, WED_14);
    expect(r?.nights).toBe(4);
    expect(r?.avgDurationMinutes).toBe(478); // 480, 475, 480, 475
    expect(r?.verdict).toBe("very_regular");
  });

  it("is irregular when times swing, and needs at least 3 recorded nights", () => {
    const nights: Array<[string, string, string]> = [
      ["2026-11-03", "22:00", "06:00"],
      ["2026-11-01", "01:00", "09:30"],
      ["2026-10-30", "23:30", "07:30"],
    ];
    expect(sleepRegularity(logsFrom(nights), WED_14)?.verdict).toBe("irregular");
    expect(sleepRegularity(logsFrom(nights.slice(0, 2)), WED_14)).toBeNull();
  });

  it("ignores unvalidated times", () => {
    const logs: DailySleepLog[] = [{ date: "2026-11-04", wakeTime: "07:00", wakeTimeValidated: false }];
    expect(sleepRegularity(logs, WED_14)).toBeNull();
  });
});

describe("best hours", () => {
  it("finds the 3-hour window where most work is finished", () => {
    const tasks = [task({ id: "t" })];
    const completions = Array.from({ length: 6 }, (_, i) =>
      completion({ id: `c${i}`, date: `2026-11-0${i + 1}`, actualStartTime: "09:00", actualEndTime: "10:30" }),
    ).concat([completion({ id: "late", actualStartTime: "21:00", actualEndTime: "21:30" })]);
    const r = focusByHour({ tasks, completions }, WED_14);
    expect(r.minutesByHour[9]).toBe(6 * 60);
    expect(r.minutesByHour[10]).toBe(6 * 30);
    expect(r.best).toMatchObject({ startHour: 8, endHour: 11 });
    expect(r.best!.sharePercent).toBeGreaterThan(90);
  });

  it("stays quiet without enough data", () => {
    const r = focusByHour({ tasks: [task()], completions: [completion({ actualStartTime: "09:00", actualEndTime: "10:00" })] }, WED_14);
    expect(r.best).toBeNull();
  });
});
