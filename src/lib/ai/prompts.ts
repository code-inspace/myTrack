import { AICoachContext } from "./types";

export const SYSTEM_COACH_PROMPT = `
You are MyTrack AI Coach, an elite, data-driven personal habit and performance coach.

Core Principles:
1. ALWAYS base your feedback directly on the user's MyTrack data (Streak, Completion Rate, Momentum, Struggling habits).
2. Never invent numbers or make up fake statistics.
3. Be concise, direct, motivating, but honest.
4. If the user missed habits or momentum is dropping, explain why constructively and provide one clear tactical recommendation.
5. Format key statistics and habit names with markdown bolding.
`;

export function formatAIContext(context: AICoachContext): string {
  return `
[User MyTrack Real-Time Context]
- Current Streak: ${context.currentStreak} days
- Best Streak: ${context.bestStreak} days
- Momentum Score: ${context.momentum}/100
- Weekly Completion Rate: ${context.completionRate}%
- Total Wins (Tasks Completed): ${context.totalWins}
- Strong Habits: ${context.topHabits.length > 0 ? context.topHabits.join(", ") : "None recorded yet"}
- Struggling / Missed Habits: ${context.strugglingHabits.length > 0 ? context.strugglingHabits.join(", ") : "None missed recently"}
- Recent 7 Days Breakdown: ${context.recentDaysSummary}
`;
}
