"use client";

import { useMemo } from "react";
import { useGoals } from "@/features/goals/hooks";
import { computeGoalProgress } from "@/features/goals/actions";
import { getGoalPeriodKey, type Goal, type GoalProgressResult } from "@/features/goals/types";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { getTodayDateString } from "@/lib/dates";
import type { Project } from "@/features/projects/types";
import { goalPace, sortByRisk, type GoalPace } from "./insights";

export interface GoalItem {
  goal: Goal;
  progress: GoalProgressResult;
  project: Project | null;
  pace: GoalPace;
}

/** The goals of one period (recurring ones included) with their progress and pace, riskiest first. */
export function useGoalItems(periodType: "day" | "week" | "month", referenceDate: Date) {
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { allTasks, allCompletions } = useTasks(getTodayDateString());
  const { events: externalEvents } = useCalendarEvents();

  const items = useMemo<GoalItem[]>(() => {
    const now = new Date();
    const key = getGoalPeriodKey(periodType, referenceDate);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const list = goals
      .filter((g) => g.periodType === periodType && (g.isRecurring || !g.periodKey || g.periodKey === key))
      .map((goal) => {
        const progress = computeGoalProgress({
          goal,
          period: periodType,
          referenceDate,
          tasks: allTasks,
          completions: allCompletions,
          externalEvents,
          projects,
        });
        return { goal, progress, project: byId.get(goal.projectId) || null, pace: goalPace(goal, progress, referenceDate, now) };
      });
    return sortByRisk(list);
  }, [goals, periodType, referenceDate, allTasks, allCompletions, externalEvents, projects]);

  return { items, goals, projects };
}
