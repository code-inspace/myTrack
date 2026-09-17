"use client";

import React, { useState, useMemo } from "react";
import { PeriodSelector } from "@/features/dashboard/components/PeriodSelector";
import { Period } from "@/features/dashboard/types";
import { AppHeader } from "@/components/shared/AppHeader";
import { useGoals } from "@/features/goals/hooks";
import { GoalCard } from "@/features/goals/components/GoalCard";
import { GoalSummaryHeader } from "@/features/goals/components/GoalSummaryHeader";
import { GoalFormModal } from "@/features/goals/components/GoalFormModal";
import { computeGoalProgress } from "@/features/goals/actions";
import { Goal, GoalPeriodType, getGoalPeriodKey, getGoalPeriodHumanLabel } from "@/features/goals/types";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { getTodayDateString } from "@/lib/dates";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { addWeeks, subWeeks, addMonths, subMonths, addDays, subDays } from "date-fns";
import { Plus, Target, Sparkles, Filter, AlertCircle, ArrowUpDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GoalsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Swipe navigation handling
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || period === "all") return;
    const touchEnd = e.changedTouches[0];
    const dx = touchEnd.clientX - touchStart.x;
    const dy = touchEnd.clientY - touchStart.y;

    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        if (period === "day") setReferenceDate((prev) => addDays(prev, 1));
        else if (period === "week") setReferenceDate((prev) => addWeeks(prev, 1));
        else if (period === "month") setReferenceDate((prev) => addMonths(prev, 1));
      } else {
        if (period === "day") setReferenceDate((prev) => subDays(prev, 1));
        else if (period === "week") setReferenceDate((prev) => subWeeks(prev, 1));
        else if (period === "month") setReferenceDate((prev) => subMonths(prev, 1));
      }
    }
    setTouchStart(null);
  };

  // Data fetching
  const { goals, isLoading: isGoalsLoading, createGoal, updateGoal, deleteGoal } = useGoals();
  const { projects } = useProjects();
  const { allTasks, allCompletions } = useTasks(getTodayDateString());
  const { events: externalEvents } = useCalendarEvents();

  // Create lookup dictionary for projects
  const projectsById = useMemo(() => {
    const map = new Map<string, (typeof projects)[0]>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  const activePeriodKey = useMemo(() => {
    return getGoalPeriodKey(period, referenceDate);
  }, [period, referenceDate]);

  const activePeriodLabel = useMemo(() => {
    return getGoalPeriodHumanLabel(period, referenceDate);
  }, [period, referenceDate]);

  // Filter goals specifically for the active period & reference date
  const displayedGoals = useMemo(() => {
    return goals.filter((g) => {
      if (g.periodKey) {
        return g.periodKey === activePeriodKey;
      }
      if (period === "all") return true;
      return g.periodType === period;
    });
  }, [goals, activePeriodKey, period]);

  // Compute progress for each goal for the selected period & referenceDate
  const goalsWithProgress = useMemo(() => {
    return displayedGoals.map((goal) => {
      const progress = computeGoalProgress({
        goal,
        period,
        referenceDate,
        tasks: allTasks,
        completions: allCompletions,
        externalEvents,
      });
      return {
        goal,
        progress,
        project: projectsById.get(goal.projectId) || null,
      };
    });
  }, [displayedGoals, period, referenceDate, allTasks, allCompletions, externalEvents, projectsById]);

  // Summary aggregation
  const summaryStats = useMemo(() => {
    let totalTarget = 0;
    let totalActual = 0;
    let completedCount = 0;

    for (const item of goalsWithProgress) {
      totalTarget += item.progress.targetMinutes;
      totalActual += item.progress.actualMinutes;
      if (item.progress.isCompleted) {
        completedCount++;
      }
    }

    return {
      totalTargetMinutes: totalTarget,
      totalActualMinutes: totalActual,
      completedGoalsCount: completedCount,
      totalGoalsCount: goalsWithProgress.length,
    };
  }, [goalsWithProgress]);

  const handleOpenCreateModal = () => {
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleSaveGoal = async (
    payload: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">,
    goalId?: string
  ) => {
    if (goalId) {
      await updateGoal({ id: goalId, updates: payload });
    } else {
      await createGoal(payload);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    await deleteGoal(goalId);
  };

  const defaultModalPeriod: GoalPeriodType =
    period === "day" ? "day" : period === "month" ? "month" : "week";

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-[#0E0F12] relative overflow-hidden">
      {/* 1. Mobile Fixed Header */}
      <div className="flex-shrink-0 z-30 shadow-md md:hidden bg-[#111214] border-b border-[#23242A]">
        <AppHeader title="Objectifs" />
      </div>

      {/* 2. Main Scrollable Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-28 md:pb-12 space-y-5 max-w-md md:max-w-6xl mx-auto w-full px-4 md:px-8 pt-3 md:pt-6"
      >
        {/* Desktop Top Header */}
        <div className="hidden md:flex items-center justify-between pb-2 select-none flex-shrink-0">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Target className="w-7 h-7 text-[#D4F63D]" />
              <span>Objectifs & Cibles</span>
            </h1>
            <p className="text-xs text-[#8E929E] mt-0.5">
              Définissez vos temps cibles par projet ou sous-projet et suivez votre progression
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-2xl bg-[#D4F63D] hover:bg-[#bce028] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel objectif</span>
          </button>
        </div>

        {/* Period Selector Tabs & Chevron Navigation (Jour / Semaine / Mois) */}
        <PeriodSelector
          period={period}
          onChangePeriod={setPeriod}
          referenceDate={referenceDate}
          onChangeReferenceDate={setReferenceDate}
        />

        {/* Global Summary Header Widget */}
        {goals.length > 0 && (
          <GoalSummaryHeader
            totalTargetMinutes={summaryStats.totalTargetMinutes}
            totalActualMinutes={summaryStats.totalActualMinutes}
            completedGoalsCount={summaryStats.completedGoalsCount}
            totalGoalsCount={summaryStats.totalGoalsCount}
            period={period}
          />
        )}

        {/* Section Header with Quick Actions & Filters */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Mes Objectifs ({goalsWithProgress.length})</span>
              <span className="text-[#8E929E] font-normal text-xs lowercase">• {activePeriodLabel}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Add Button */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="md:hidden px-3 py-1.5 rounded-xl bg-[#D4F63D] text-black font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {/* Goals Grid or Empty State */}
        {goalsWithProgress.length === 0 ? (
          <div className="bg-[#141519] border border-[#23252E] rounded-3xl p-8 md:p-12 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-3xl bg-[#D4F63D]/10 text-[#D4F63D] flex items-center justify-center mx-auto border border-[#D4F63D]/20">
              <Target className="w-8 h-8" />
            </div>

            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-lg font-bold text-white">
                Aucun objectif pour {period === "day" ? "ce jour" : period === "week" ? "cette semaine" : "ce mois"}
              </h3>
              <p className="text-xs text-[#8E929E]">
                Définissez un objectif temporel pour <strong className="text-white">{activePeriodLabel}</strong> (ex: 3h de Projet A, 10h de sous-projet X).
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-3 rounded-2xl bg-[#D4F63D] hover:bg-[#bce028] text-black text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Créer un objectif pour cette période</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goalsWithProgress.map(({ goal, progress, project }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progress={progress}
                project={project}
                period={period}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteGoal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Goal Creation / Modification Modal */}
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
        onDelete={handleDeleteGoal}
      />
    </div>
  );
}
