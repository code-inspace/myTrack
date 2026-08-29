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
import { AppHeader } from "@/components/shared/AppHeader";
import { useAuth } from "@/providers/AuthProvider";
import { useDisplayMode } from "@/providers/DisplayModeProvider";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  const { data: stats, isLoading } = useDashboardStats(period, referenceDate);
  const { allTasks, allCompletions } = useTasks(getTodayDateString());
  const { user } = useAuth();
  const { displayMode } = useDisplayMode();

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-28 md:pb-10 space-y-4 max-w-md md:max-w-6xl mx-auto w-full px-4 md:px-8 pt-2 md:pt-6">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between pb-2 select-none flex-shrink-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Dashboard &amp; Statistiques</span>
          </h1>
          <p className="text-xs text-[#8E929E] mt-0.5">Analyse de ta progression, régularité et momentum</p>
        </div>
      </div>

      {/* Mobile Title Header */}
      <div className="md:hidden">
        <AppHeader
          title="Dashboard"
          rightAction={
            displayMode === "modern"
              ? { href: "/profile", initial: (user?.name?.[0] || "?").toUpperCase(), label: "Profil" }
              : undefined
          }
        />
      </div>

      {/* Period Selector Tabs & Chevron Navigation: [Semaine] [Mois] [Tout le temps] */}
      <PeriodSelector
        period={period}
        onChangePeriod={setPeriod}
        referenceDate={referenceDate}
        onChangeReferenceDate={setReferenceDate}
      />

      {/* Top band — desktop: momentum spans two thirds, metric cards stack in the last third */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {/* Momentum Gauge & Wave Chart */}
        <div className="lg:col-span-2 bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-2">
          <MomentumGauge
            score={stats?.momentum ?? 68}
            delta={stats?.momentumDelta ?? 10}
          />

          {/* Wave Chart with Grid and Neon Lime Curve */}
          <WaveChart data={stats?.momentumHistory || []} period={period} />
        </div>

        {/* Two Metric Cards: side-by-side on mobile, stacked in the side column on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
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
      </div>

      {/* Bottom band — sleep trend beside the period-specific habit view on desktop */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
    </div>
  );
}
