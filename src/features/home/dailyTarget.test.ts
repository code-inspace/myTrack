import { describe, expect, it } from "vitest";
import { dailyStreak, daysUntil, minutesByDate } from "./dailyTarget";
import type { Task, TaskCompletion } from "@/features/tasks/types";

const settings = { dailyTargetMinutes: 300, weekdaysOnly: true, jokersPerWeek: 1 };
// Thursday 5 Nov 2026
const today = new Date(2026, 10, 5, 12, 0);
const m = (entries: Array<[string, number]>) => new Map(entries);

describe("dailyStreak", () => {
  it("counts consecutive working days at target, weekends ignored", () => {
    const r = dailyStreak(
      m([
        ["2026-11-05", 300],
        ["2026-11-04", 320],
        ["2026-11-03", 300],
        ["2026-11-02", 300],
        ["2026-10-30", 300], // Friday before; the weekend between is skipped
      ]),
      settings,
      today,
    );
    expect(r.streak).toBe(5);
    expect(r.hitToday).toBe(true);
  });

  it("today in progress does not break the streak", () => {
    const r = dailyStreak(m([["2026-11-04", 300], ["2026-11-03", 300]]), settings, today);
    expect(r.streak).toBe(2);
    expect(r.hitToday).toBe(false);
  });

  it("forgives one missed day per week with the joker, then breaks", () => {
    const oneMiss = dailyStreak(m([["2026-11-04", 300], ["2026-11-02", 300]]), settings, today); // Tue 3 missed
    expect(oneMiss.streak).toBe(2);
    expect(oneMiss.jokersLeft).toBe(0);

    const twoMiss = dailyStreak(m([["2026-11-04", 300]]), settings, today); // Tue + Mon missed, one joker
    expect(twoMiss.streak).toBe(1);
  });

  it("returns an empty streak without a target", () => {
    expect(dailyStreak(m([]), { ...settings, dailyTargetMinutes: 0 }, today).streak).toBe(0);
  });

  it("flags a rest day on weekends", () => {
    expect(dailyStreak(m([]), settings, new Date(2026, 10, 7)).restDay).toBe(true);
  });
});

describe("daysUntil", () => {
  it("counts whole days and rejects bad dates", () => {
    expect(daysUntil("2026-11-10", today)).toBe(5);
    expect(daysUntil("2026-11-01", today)).toBe(-4);
    expect(daysUntil("", today)).toBeNull();
  });
});

describe("minutesByDate", () => {
  it("only sums completed work of the given projects", () => {
    const task = (id: string, projectId: string | null, title = "x") =>
      ({ id, projectId, title, trackingType: "DURATION", targetValue: 60, unit: "min", recurrence: "ONCE" }) as unknown as Task;
    const comp = (taskId: string, date: string, duration: number, completed = true) =>
      ({ taskId, date, duration, completed }) as unknown as TaskCompletion;
    const result = minutesByDate(
      {
        tasks: [task("a", "p1"), task("b", "p2"), task("c", null), task("d", "p1", "Sommeil")],
        completions: [comp("a", "2026-11-05", 90), comp("a", "2026-11-05", 30, false), comp("b", "2026-11-05", 60), comp("c", "2026-11-05", 60), comp("d", "2026-11-05", 480)],
      },
      new Set(["p1"]),
    );
    expect(result.get("2026-11-05")).toBe(90);
  });
});
