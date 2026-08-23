import { describe, it, expect } from "vitest";
import { formatAIContext } from "@/lib/ai/prompts";
import { AICoachContext } from "@/lib/ai/types";

describe("AI Coach Context Formatting", () => {
  it("formats structured MyTrack user context without raw dumps", () => {
    const context: AICoachContext = {
      currentStreak: 4,
      bestStreak: 7,
      momentum: 64,
      completionRate: 75,
      totalWins: 15,
      tasksScheduled: 4,
      tasksCompleted: 3,
      topHabits: ["Morning workout", "Push-ups"],
      strugglingHabits: ["Read book"],
      recentDaysSummary: "Thu: Done, Fri: Missed, Sat: Done, Sun: Done",
    };

    const formatted = formatAIContext(context);
    expect(formatted).toContain("Current Streak: 4 days");
    expect(formatted).toContain("Momentum Score: 64/100");
    expect(formatted).toContain("Morning workout, Push-ups");
    expect(formatted).toContain("Read book");
  });
});
