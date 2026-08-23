"use client";

import React, { useState } from "react";
import { PeriodSelector } from "@/features/dashboard/components/PeriodSelector";
import { MomentumGauge } from "@/features/dashboard/components/MomentumGauge";
import { WaveChart } from "@/features/dashboard/components/WaveChart";
import { CircularMetricCard } from "@/features/dashboard/components/CircularProgressCard";
import { StreakGridCard } from "@/features/dashboard/components/StreakGridCard";
import { MonthlyHabitCalendar } from "@/features/dashboard/components/MonthlyHabitCalendar";
import { SleepWaveChart } from "@/features/dashboard/components/SleepWaveChart";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { Period } from "@/features/dashboard/types";
import { getTodayDateString } from "@/lib/dates";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  const { data: stats, isLoading } = useDashboardStats(period, referenceDate);
  const { allTasks, allCompletions } = useTasks(getTodayDateString());

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-28 space-y-4 max-w-md mx-auto w-full px-4 pt-2">
      {/* Dashboard Title Header */}
      <header className="w-full text-center py-2">
        <h1 className="text-xl font-extrabold text-white tracking-tight">
          Dashboard
        </h1>
      </header>

      {/* Period Selector Tabs & Chevron Navigation: [Semaine] [Mois] [Tout le temps] */}
      <PeriodSelector
        period={period}
        onChangePeriod={setPeriod}
        referenceDate={referenceDate}
        onChangeReferenceDate={setReferenceDate}
      />

      {/* Momentum Gauge & Wave Chart */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-2">
        <MomentumGauge
          score={stats?.momentum ?? 68}
          delta={stats?.momentumDelta ?? 10}
        />

        {/* Wave Chart with Grid and Neon Lime Curve */}
        <WaveChart data={stats?.momentumHistory || []} period={period} />
      </div>

      {/* Two Metric Cards Side-by-Side: Complétion moyenne & Victoires totales */}
      <div className="flex gap-3 w-full">
        <CircularMetricCard
          title="Complétion moyenne"
          valueText={`${stats?.completionRate ?? 40}%`}
          percentage={stats?.completionRate ?? 40}
        />

        <CircularMetricCard
          title="Victoires totales"
          valueText={`${stats?.totalWins ?? 15}`}
          subText={`sur ${stats?.totalTargetWins ?? 20}`}
          percentage={
            stats && stats.totalTargetWins > 0
              ? Math.round((stats.totalWins / stats.totalTargetWins) * 100)
              : 75
          }
        />
      </div>

      {/* Nightly Sleep Tracking Wave Chart */}
      <SleepWaveChart period={period} referenceDate={referenceDate} />

      {/* View per selected period */}
      {period === "month" ? (
        /* Monthly Calendar with Habit Select Dropdown (Recurring Habits only) */
        <MonthlyHabitCalendar
          tasks={allTasks.filter((t) => t.recurrence && t.recurrence !== "ONCE")}
          completions={allCompletions}
          monthDate={referenceDate}
        />
      ) : (
        /* Per-Habit Streaks with Rolling 7-Day Visual Matrix */
        <StreakGridCard
          habitStreaks={stats?.habitStreaks || []}
          dailyStatus={stats?.last7DaysStatus || []}
        />
      )}
    </div>
  );
}
