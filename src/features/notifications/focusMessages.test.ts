import { describe, expect, it } from "vitest";
import type { GoalInsightItem } from "@/features/bilan/insights";
import { eveningFocusMessage, morningFocusMessage } from "./focusMessages";

const item = (status: "behind" | "on_track" | "done", remaining: number, name = "Révisions"): GoalInsightItem => ({
  goalId: name,
  name,
  targetType: "duration",
  pace: { status, expectedPercent: 50, remaining, perDay: remaining / 3, daysLeft: 3, isCount: false },
});

describe("focus notification messages", () => {
  it("falls back to the default text when there is no goal", () => {
    expect(morningFocusMessage({ items: [], todayMinutes: 0, weekday: 2 })).toBeNull();
    expect(eveningFocusMessage({ items: [], todayMinutes: 0, weekday: 2 })).toBeNull();
  });

  it("morning names the goal to act on and a session length", () => {
    const m = morningFocusMessage({ items: [item("behind", 180)], todayMinutes: 0, weekday: 2 });
    expect(m?.title).toBe("Tu es en retard sur un objectif");
    expect(m?.body).toContain("Révisions");
    expect(m?.body).toContain("3h");
  });

  it("morning celebrates when everything is done", () => {
    const m = morningFocusMessage({ items: [item("done", 0)], todayMinutes: 0, weekday: 2 });
    expect(m?.title).toBe("Objectifs de la semaine atteints");
  });

  it("evening reports today and what is left", () => {
    const m = eveningFocusMessage({ items: [item("behind", 120)], todayMinutes: 95, weekday: 3 });
    expect(m?.body).toContain("Aujourd'hui : 1h35");
    expect(m?.body).toContain("2h");
  });

  it("Sunday evening is the weekly verdict", () => {
    const m = eveningFocusMessage({ items: [item("done", 0, "A"), item("behind", 60, "B")], todayMinutes: 0, weekday: 0 });
    expect(m?.title).toBe("Bilan de la semaine");
    expect(m?.body).toContain("1 objectif atteint sur 2");
  });
});
