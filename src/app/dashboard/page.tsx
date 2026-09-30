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
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { Sliders } from "lucide-react";

const DASHBOARD_CONFIG_STORAGE_KEY = "mytrack_dashboard_modules_config";

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("Dashboard widget render error caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm text-center space-y-2">
          <p className="text-xs text-[#8E929E]">Module temporairement indisponible</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="text-[11px] font-semibold text-[#D4F63D] hover:underline"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any) {
    console.error("Dashboard Page render error caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 bg-[#0E0F12] text-white text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1C1D22] border border-[#282A30] flex items-center justify-center text-[#D4F63D] shadow-md">
            <Sliders className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Dashboard temporairement indisponible</h2>
          <p className="text-xs text-[#8E929E] max-w-sm">
            Une erreur est survenue lors du chargement des statistiques.
          </p>
          {this.state.error?.message && (
            <p className="text-[10px] text-red-400/80 font-mono max-w-xs break-words">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(DASHBOARD_CONFIG_STORAGE_KEY);
              } catch {}
              this.setState({ hasError: false, error: null });
            }}
            className="px-4 py-2 rounded-xl bg-[#D4F63D] text-black text-xs font-bold hover:bg-[#C2E232] transition-colors cursor-pointer"
          >
            Réinitialiser l&apos;affichage
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DashboardPage() {
  return (
    <PageErrorBoundary>
      <DashboardPageContent />
    </PageErrorBoundary>
  );
}

function DashboardPageContent() {
  const [period, setPeriod] = useState<Period>("week");
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-no-swipe]") ||
      target.closest("[data-sleep-chart]") ||
      target.closest("[data-project-chart]") ||
      target.closest("button") ||
      target.closest("input")
    ) {
      setTouchStart(null);
      return;
    }
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || period === "all") return;
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-no-swipe]") ||
      target.closest("[data-sleep-chart]") ||
      target.closest("[data-project-chart]")
    ) {
      setTouchStart(null);
      return;
    }
    const touchEnd = e.changedTouches[0];
    const dx = touchEnd.clientX - touchStart.x;
    const dy = touchEnd.clientY - touchStart.y;

    // Detect clear horizontal swipe of at least 45px
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        // Swipe left -> Next period
        if (period === "week") setReferenceDate((prev) => addWeeks(prev, 1));
        else if (period === "month") setReferenceDate((prev) => addMonths(prev, 1));
      } else {
        // Swipe right -> Previous period
        if (period === "week") setReferenceDate((prev) => subWeeks(prev, 1));
        else if (period === "month") setReferenceDate((prev) => subMonths(prev, 1));
      }
    }
    setTouchStart(null);
  };

  const [modules, setModules] = useState<DashboardModuleConfig[]>(DEFAULT_DASHBOARD_MODULES);

  // Load customized module config on client mount to prevent SSR hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validParsed = parsed.filter((p: any) => p && typeof p === "object" && typeof p.id === "string");
          const existingIds = new Set(validParsed.map((p: any) => p.id));
          const merged = [...validParsed];
          for (const def of DEFAULT_DASHBOARD_MODULES) {
            if (!existingIds.has(def.id)) {
              merged.push(def);
            }
          }
          if (merged.length > 0) {
            setModules(merged);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveModules = (newModules: DashboardModuleConfig[]) => {
    setModules(newModules);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          DASHBOARD_CONFIG_STORAGE_KEY,
          JSON.stringify(newModules)
        );
      } catch {}
    }
  };

  const safeReferenceDate =
    referenceDate instanceof Date && !isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  const { data: stats, isLoading } = useDashboardStats(period, safeReferenceDate);
  const { allTasks = [], allCompletions = [] } = useTasks(getTodayDateString());
  const { events: externalEvents = [] } = useCalendarEvents();
  const { user } = useAuth();

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
            externalEvents={externalEvents}
            completions={allCompletions}
            period={period}
            referenceDate={safeReferenceDate}
          />
        );

      case "SLEEP_WAVE":
        return (
          <div key="SLEEP_WAVE">
            <SleepWaveChart period={period} referenceDate={safeReferenceDate} />
          </div>
        );

      case "HABITS_VIEW":
        return (
          <div key="HABITS_VIEW">
            {period === "month" ? (
              <MonthlyHabitCalendar
                tasks={(allTasks || []).filter((t) => t && t.recurrence && t.recurrence !== "ONCE")}
                completions={allCompletions}
                monthDate={safeReferenceDate}
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

  const enabledModules = (Array.isArray(modules) ? modules : DEFAULT_DASHBOARD_MODULES).filter(
    (m) => m && typeof m === "object" && typeof m.id === "string" && m.enabled !== false
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-[#0E0F12] relative overflow-hidden">
      {/* 1. Mobile Fixed Header (matching standard page layout, with header personalization) */}
      <div className="flex-shrink-0 z-30 shadow-md md:hidden bg-[#111214] border-b border-[#23242A]">
        <AppHeader
          title="Dashboard"
          rightIconAction={{
            icon: Sliders,
            label: "Personnaliser",
            onClick: () => setIsConfigModalOpen(true),
          }}
        />
      </div>

      {/* 2. Scrollable Content Body */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-28 md:pb-10 space-y-4 max-w-md md:max-w-6xl mx-auto w-full px-3 sm:px-4 md:px-8 pt-3 md:pt-6"
      >
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between pb-2 select-none flex-shrink-0">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              <span>Dashboard</span>
            </h1>
            <p className="text-xs text-[#8E929E] mt-0.5">
              Analyse de ta progression, régularité et momentum
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-[#1C1D22] hover:bg-[#252830] border border-[#282A30] hover:border-[#383C48] text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Personnaliser le dashboard"
          >
            <Sliders className="w-4 h-4 text-[#D4F63D]" />
            <span>Personnaliser</span>
          </button>
        </div>

        {/* Period Selector Tabs & Chevron Navigation */}
        <PeriodSelector
          period={period}
          onChangePeriod={setPeriod}
          referenceDate={safeReferenceDate}
          onChangeReferenceDate={setReferenceDate}
        />

        {/* Dynamically configured modules in custom order */}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {enabledModules.map((mod) => {
            return (
              <div
                key={mod.id}
                className={mod.id === "MOMENTUM_WAVE" ? "lg:col-span-2" : "w-full"}
              >
                <DashboardErrorBoundary>
                  {renderModule(mod.id)}
                </DashboardErrorBoundary>
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
    </div>
  );
}
