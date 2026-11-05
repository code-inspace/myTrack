"use client";

import React, { useMemo, useState } from "react";
import { Plus, Target } from "lucide-react";
import { useGoals } from "@/features/goals/hooks";
import { GoalCard } from "@/features/goals/components/GoalCard";
import { GoalFormModal } from "@/features/goals/components/GoalFormModal";
import { computeGoalProgress } from "@/features/goals/actions";
import { Goal, getGoalPeriodKey, getGoalPeriodHumanLabel } from "@/features/goals/types";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { getTodayDateString } from "@/lib/dates";
import type { Period } from "@/features/dashboard/types";
import { goalPace, goalsVerdict, sortByRisk } from "../insights";
import { GoalsVerdictCard } from "./GoalsVerdictCard";

export function goalDisplayName(goal: Goal, projectName?: string | null): string {
  if (goal.title) return goal.title;
  const categories =
    Array.isArray(goal.projectCategories) && goal.projectCategories.length > 0
      ? goal.projectCategories
      : goal.projectCategory
        ? [goal.projectCategory]
        : [];
  return [projectName || "Objectif", ...categories].join(" · ");
}

/** "Objectifs" tab: am I on track? Riskiest goals first, with a verdict and one action. */
export const GoalsTab: React.FC<{ period: Period; referenceDate: Date }> = ({ period, referenceDate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const { goals, createGoal, updateGoal, deleteGoal } = useGoals();
  const { projects } = useProjects();
  const { allTasks, allCompletions } = useTasks(getTodayDateString());
  const { events: externalEvents } = useCalendarEvents();

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activePeriodKey = useMemo(() => getGoalPeriodKey(period, referenceDate), [period, referenceDate]);
  const activePeriodLabel = useMemo(() => getGoalPeriodHumanLabel(period, referenceDate), [period, referenceDate]);

  const displayedGoals = useMemo(
    () =>
      goals.filter((g) => {
        if (period !== "all" && g.periodType !== period) return false;
        // Recurring goals apply to every day / week / month of their type
        if (g.isRecurring || !g.periodKey) return true;
        return g.periodKey === activePeriodKey;
      }),
    [goals, activePeriodKey, period],
  );

  const items = useMemo(() => {
    const now = new Date();
    const withProgress = displayedGoals.map((goal) => {
      // A goal is measured over its own period, whatever period the page is filtered on
      const progress = computeGoalProgress({
        goal,
        period: goal.periodType || period,
        referenceDate,
        tasks: allTasks,
        completions: allCompletions,
        externalEvents,
        projects,
      });
      const project = projectsById.get(goal.projectId) || null;
      return { goal, progress, project, pace: goalPace(goal, progress, referenceDate, now) };
    });
    return sortByRisk(withProgress);
  }, [displayedGoals, period, referenceDate, allTasks, allCompletions, externalEvents, projectsById, projects]);

  const verdict = useMemo(
    () =>
      goalsVerdict(
        items.map(({ goal, project, pace }) => ({
          goalId: goal.id,
          name: goalDisplayName(goal, project?.name),
          targetType: goal.targetType === "count" ? "count" : "duration",
          pace,
        })),
      ),
    [items],
  );

  const openCreate = () => {
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  const handleSaveGoal = async (payload: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">, goalId?: string) => {
    if (goalId) await updateGoal({ id: goalId, updates: payload });
    else await createGoal(payload);
  };

  return (
    <div className="space-y-5">
      <div className="hidden md:flex items-center justify-between">
        <p className="text-xs text-[#8E929E]">Définis tes temps cibles par projet ou sous-projet et suis ton rythme.</p>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-2xl bg-[#D4F63D] px-4 py-2.5 text-xs font-bold text-black shadow-lg hover:bg-[#bce028] cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Nouvel objectif
        </button>
      </div>

      <GoalsVerdictCard verdict={verdict} />

      <div className="flex items-center justify-between pt-1">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <span>Mes objectifs ({items.length})</span>
          <span className="text-xs font-normal lowercase text-[#8E929E]">• {activePeriodLabel}</span>
        </h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-xl bg-[#D4F63D] px-3 py-1.5 text-xs font-bold text-black shadow-md cursor-pointer md:hidden"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      {items.length === 0 ? (
        <div className="space-y-4 rounded-3xl border border-[#23252E] bg-[#141519] p-8 text-center shadow-xl md:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#D4F63D]/20 bg-[#D4F63D]/10 text-[#D4F63D]">
            <Target className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="mx-auto max-w-md space-y-1.5">
            <h3 className="text-lg font-bold text-white">
              {goals.length === 0
                ? "Fixe ton premier objectif de temps"
                : `Aucun objectif pour ${period === "day" ? "ce jour" : period === "week" ? "cette semaine" : period === "month" ? "ce mois" : "cette période"}`}
            </h3>
            <p className="text-sm text-[#8E929E]">
              {goals.length === 0
                ? "Par exemple : 3h de Postulation par semaine, 1h de Révision par jour. L'appli te dira si tu es dans le rythme et te proposera une session pour rattraper."
                : `Définis un objectif pour ${activePeriodLabel}, ou change de période pour voir les autres.`}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#D4F63D] px-5 py-3 text-xs font-bold text-black shadow-lg hover:bg-[#bce028] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {goals.length === 0 ? "Créer mon premier objectif" : "Créer un objectif pour cette période"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map(({ goal, progress, project, pace }) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={progress}
              project={project}
              period={period}
              pace={pace}
              onEdit={(g) => {
                setEditingGoal(g);
                setIsModalOpen(true);
              }}
              onDelete={(id) => deleteGoal(id)}
            />
          ))}
        </div>
      )}

      <GoalFormModal
        isOpen={isModalOpen}
        initialGoal={editingGoal}
        projects={projects}
        referenceDate={referenceDate}
        currentPeriod={period}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
        }}
        onSubmit={handleSaveGoal}
        onDelete={(id) => deleteGoal(id)}
      />
    </div>
  );
};
