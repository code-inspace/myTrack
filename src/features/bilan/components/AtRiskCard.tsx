"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import type { Task, TaskCompletion } from "@/features/tasks/types";
import { calculateHabitStreakStats } from "@/features/analytics/calculations";
import { habitsAtRisk } from "../insights";
import { InsightCard } from "./InsightCard";

/** Streaks that reset tomorrow unless the habit is done today. Hidden when nothing is at stake. */
export const AtRiskCard: React.FC<{ tasks: Task[]; completions: TaskCompletion[] }> = ({ tasks, completions }) => {
  const atRisk = useMemo(() => {
    const today = new Date();
    const habits = tasks.filter((t) => t.recurrence !== "ONCE" && !t.isArchived);
    return habitsAtRisk(calculateHabitStreakStats(habits, completions, today), today);
  }, [tasks, completions]);

  if (atRisk.length === 0) return null;

  return (
    <InsightCard
      id="insight-risk"
      title={`À valider aujourd'hui pour garder ${atRisk.length > 1 ? "tes séries" : "ta série"}`}
      icon={<Flame className="h-4 w-4 text-[#F97316]" aria-hidden="true" />}
      className="border-[#F97316]/30"
    >
      <ul className="space-y-2">
        {atRisk.slice(0, 5).map((habit) => (
          <li key={habit.taskId} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-[#E5E7EB]">{habit.title}</span>
            <span className="flex-shrink-0 font-bold text-[#F97316]">
              {habit.streak} jour{habit.streak > 1 ? "s" : ""} en jeu
            </span>
          </li>
        ))}
      </ul>
      <Link href="/tasks" className="inline-block text-sm font-bold text-[#D4F63D] hover:underline">
        Ouvrir ma liste du jour
      </Link>
    </InsightCard>
  );
};
