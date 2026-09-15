"use client";

import React, { useState, useEffect } from "react";
import { PeriodSelector } from "@/features/dashboard/components/PeriodSelector";
import { MomentumGauge } from "@/features/dashboard/components/MomentumGauge";
import { WaveChart } from "@/features/dashboard/components/WaveChart";
import { CircularMetricCard } from "@/features/dashboard/components/CircularProgressCard";
import { StreakGridCard } from "@/features/dashboard/components/StreakGridCard";
import { MonthlyHabitCalendar } from "@/features/dashboard/components/MonthlyHabitCalendar";
import { SleepWaveChart } from "@/features/dashboard/components/SleepWaveChart";
import { DashboardProjectStatsWidget } from "@/features/dashboard/components/DashboardProjectStatsWidget";
import {
  DashboardConfigModal,
  DashboardModuleConfig,
  DEFAULT_DASHBOARD_MODULES,
} from "@/features/dashboard/components/DashboardConfigModal";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { Period } from "@/features/dashboard/types";
import { getTodayDateString } from "@/lib/dates";
import { AppHeader } from "@/components/shared/AppHeader";
import { useAuth } from "@/providers/AuthProvider";
import { useDisplayMode } from "@/providers/DisplayModeProvider";
import { Sliders } from "lucide-react";

const DASHBOARD_CONFIG_STORAGE_KEY = "mytrack_dashboard_modules_config";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const [modules, setModules] = useState<DashboardModuleConfig[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DASHBOARD_CONFIG_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Ensure any new default modules are merged in
            const existingIds = new Set(parsed.map((p: any) => p.id));
            const merged = [...parsed];
            for (const def of DEFAULT_DASHBOARD_MODULES) {
              if (!existingIds.has(def.id)) {
                merged.push(def);
              }
            }
            return merged;
          }
        }
      } catch {}
    }
    return DEFAULT_DASHBOARD_MODULES;
  });

  const handleSaveModules = (newModules: DashboardModuleConfig[]) => {
    setModules(newModules);
    if (typeof window !== "undefined") {
      localStorage.setItem(DASHBOARD_CONFIG_STORAGE_KEY, JSON.stringify(newModules));
    }
  };

  const { data: stats, isLoading } = useDashboardStats(period, referenceDate);
  const { allTasks, allCompletions } = useTasks(getTodayDateString());
  const { user } = useAuth();
  const { displayMode } = useDisplayMode();

  // Render individual modules based on ID
  const renderModule = (moduleId: string) => {
    switch (moduleId) {
      case "MOMENTUM_WAVE":
        return (
          <div
            key="MOMENTUM_WAVE"
            className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-2"
          >
            <MomentumGauge
              score={stats?.momentum ?? 68}
              delta={stats?.momentumDelta ?? 10}
            />
            <WaveChart data={stats?.momentumHistory || []} period={period} />
          </div>
        );

      case "METRICS":
        return (
          <div key="METRICS" className="grid grid-cols-2 gap-3">
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
        );

      case "PROJECT_STATS":
        return (
          <DashboardProjectStatsWidget
            key="PROJECT_STATS"
            tasks={allTasks}
            completions={allCompletions}
            period={period}
            referenceDate={referenceDate}
          />
        );

      case "SLEEP_WAVE":
        return (
          <div key="SLEEP_WAVE">
            <SleepWaveChart period={period} referenceDate={referenceDate} />
          </div>
        );

      case "HABITS_VIEW":
        return (
          <div key="HABITS_VIEW">
            {period === "month" ? (
              <MonthlyHabitCalendar
                tasks={allTasks.filter((t) => t.recurrence && t.recurrence !== "ONCE")}
                completions={allCompletions}
                monthDate={referenceDate}
              />
            ) : (
              <StreakGridCard
                habitStreaks={stats?.habitStreaks || []}
                dailyStatus={stats?.last7DaysStatus || []}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const enabledModules = modules.filter((m) => m.enabled);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-28 md:pb-10 space-y-4 max-w-md md:max-w-6xl mx-auto w-full px-4 md:px-8 pt-2 md:pt-6">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between pb-2 select-none flex-shrink-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Dashboard &amp; Statistiques</span>
          </h1>
          <p className="text-xs text-[#8E929E] mt-0.5">
            Analyse de ta progression, régularité et momentum
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsConfigModalOpen(true)}
          className="px-3.5 py-2 rounded-2xl bg-[#1C1D22] hover:bg-[#252830] border border-[#282A30] hover:border-[#383C48] text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <Sliders className="w-4 h-4 text-[#D4F63D]" />
          <span>Personnaliser</span>
        </button>
      </div>

      {/* Mobile Title Header */}
      <div className="md:hidden flex items-center justify-between">
        <div className="flex-1">
          <AppHeader
            title="Dashboard"
            rightAction={
              displayMode === "modern"
                ? { href: "/profile", initial: (user?.name?.[0] || "?").toUpperCase(), label: "Profil" }
                : undefined
            }
          />
        </div>
        <button
          type="button"
          onClick={() => setIsConfigModalOpen(true)}
          className="p-2 rounded-xl bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white transition-colors ml-2 cursor-pointer"
          title="Personnaliser le dashboard"
        >
          <Sliders className="w-4 h-4 text-[#D4F63D]" />
        </button>
      </div>

      {/* Period Selector Tabs & Chevron Navigation: [Semaine] [Mois] [Tout le temps] */}
      <PeriodSelector
        period={period}
        onChangePeriod={setPeriod}
        referenceDate={referenceDate}
        onChangeReferenceDate={setReferenceDate}
      />

      {/* Dynamically configured modules in custom order */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {enabledModules.map((mod) => {
          // Allow MOMENTUM_WAVE and SLEEP_WAVE to expand nicely if desired
          return (
            <div
              key={mod.id}
              className={mod.id === "MOMENTUM_WAVE" ? "lg:col-span-2" : "w-full"}
            >
              {renderModule(mod.id)}
            </div>
          );
        })}
      </div>

      {/* Dashboard Configuration Modal */}
      <DashboardConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        modules={modules}
        onSave={handleSaveModules}
      />
    </div>
  );
}
