"use client";

import React, { useState } from "react";
import { PeriodSelector } from "@/features/dashboard/components/PeriodSelector";
import { MomentumGauge } from "@/features/dashboard/components/MomentumGauge";
import { WaveChart } from "@/features/dashboard/components/WaveChart";
import { CircularMetricCard } from "@/features/dashboard/components/CircularProgressCard";
import { StreakGridCard } from "@/features/dashboard/components/StreakGridCard";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { Period } from "@/features/dashboard/types";
import { Flame, Sparkles, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("week");
  const { data: stats, isLoading } = useDashboardStats(period);

  return (
    <div className="flex-1 flex flex-col pb-10 space-y-4">
      {/* Header */}
      <header className="w-full text-center py-2">
        <h1 className="text-xl font-extrabold text-white tracking-tight">
          Dashboard
        </h1>
      </header>

      {/* Period Selector Tabs: [This week] [This month] [All time] */}
      <PeriodSelector period={period} onChange={setPeriod} />

      {/* Momentum Section matching screenshot */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-2">
        <MomentumGauge
          score={stats?.momentum ?? 64}
          delta={stats?.momentumDelta ?? 10}
        />

        {/* Wave Chart with Grid and Neon Lime Curve */}
        <WaveChart data={stats?.momentumHistory || []} />
      </div>

      {/* Two Metric Cards Side-by-Side: Avg Daily Completion (40%) & Total wins (15 of 20) */}
      <div className="flex gap-3 w-full">
        <CircularMetricCard
          title="Avg Daily Completion"
          valueText={`${stats?.completionRate ?? 40}%`}
          percentage={stats?.completionRate ?? 40}
        />

        <CircularMetricCard
          title="Total wins"
          valueText={`${stats?.totalWins ?? 15}`}
          subText={`of ${stats?.totalTargetWins ?? 20}`}
          percentage={
            stats && stats.totalTargetWins > 0
              ? Math.round((stats.totalWins / stats.totalTargetWins) * 100)
              : 75
          }
        />
      </div>

      {/* Current Streak with 7 Day Checkmark Row */}
      <StreakGridCard
        currentStreak={stats?.currentStreak ?? 4}
        days={stats?.last7DaysStatus || []}
      />
    </div>
  );
}
