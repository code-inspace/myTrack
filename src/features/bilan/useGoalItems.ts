"use client";

import { useMemo } from "react";
import { useGoals } from "@/features/goals/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { getTodayDateString } from "@/lib/dates";
import { buildGoalItems } from "./goalItems";

export type { GoalItem } from "./goalItems";

/** The goals of one period with their progress and pace, riskiest first. */
export function useGoalItems(periodType: "day" | "week" | "month", referenceDate: Date) {
  const { goals, isLoading } = useGoals();
  const { projects } = useProjects();
  const { allTasks, allCompletions } = useTasks(getTodayDateString());
  const { events: externalEvents } = useCalendarEvents();

  const items = useMemo(
    () => buildGoalItems({ goals, projects, tasks: allTasks, completions: allCompletions, externalEvents, periodType, referenceDate }),
    [goals, projects, allTasks, allCompletions, externalEvents, periodType, referenceDate],
  );

  return { items, goals, projects, isLoading };
}
