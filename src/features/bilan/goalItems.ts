import { computeGoalProgress } from "@/features/goals/actions";
import { getGoalPeriodKey, type Goal, type GoalProgressResult } from "@/features/goals/types";
import type { Project } from "@/features/projects/types";
import type { Task, TaskCompletion } from "@/features/tasks/types";
import type { ExternalCalendarEvent } from "@/features/calendar/types";
import { goalPace, sortByRisk, type GoalPace } from "./insights";

export interface GoalItem {
  goal: Goal;
  progress: GoalProgressResult;
  project: Project | null;
  pace: GoalPace;
}

/** The goals of one period (recurring ones included) with progress and pace, riskiest first. */
export function buildGoalItems(params: {
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  completions: TaskCompletion[];
  externalEvents?: ExternalCalendarEvent[];
  periodType: "day" | "week" | "month";
  referenceDate: Date;
  now?: Date;
}): GoalItem[] {
  const { goals, projects, tasks, completions, externalEvents = [], periodType, referenceDate } = params;
  const now = params.now ?? new Date();
  const key = getGoalPeriodKey(periodType, referenceDate);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const list = goals
    .filter((g) => g.periodType === periodType && (g.isRecurring || !g.periodKey || g.periodKey === key))
    .map((goal) => {
      const progress = computeGoalProgress({ goal, period: periodType, referenceDate, tasks, completions, externalEvents, projects });
      return { goal, progress, project: byId.get(goal.projectId) || null, pace: goalPace(goal, progress, referenceDate, now) };
    });
  return sortByRisk(list);
}
