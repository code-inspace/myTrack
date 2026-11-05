"use client";

import React, { useEffect, useState } from "react";
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
import type { Period } from "@/features/dashboard/types";
import { getTodayDateString } from "@/lib/dates";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { AtRiskCard } from "./AtRiskCard";
import { TimeDeltasCard } from "./TimeDeltasCard";
import { PlannedVsDoneCard } from "./PlannedVsDoneCard";
import { SleepRegularityCard } from "./SleepRegularityCard";
import { FocusHoursCard } from "./FocusHoursCard";

export const DASHBOARD_CONFIG_STORAGE_KEY = "mytrack_dashboard_modules_config";

/** Keeps the stored order, drops removed modules, and slots new ones at their default position. */
export function mergeModules(stored: unknown): DashboardModuleConfig[] {
  if (!Array.isArray(stored)) return DEFAULT_DASHBOARD_MODULES;
  const known = new Set(DEFAULT_DASHBOARD_MODULES.map((m) => m.id));
  const merged = stored.filter(
    (p): p is DashboardModuleConfig => !!p && typeof p === "object" && typeof p.id === "string" && known.has(p.id),
  );
  if (merged.length === 0) return DEFAULT_DASHBOARD_MODULES;
  const present = new Set(merged.map((m) => m.id));
  DEFAULT_DASHBOARD_MODULES.forEach((def, index) => {
    if (!present.has(def.id)) merged.splice(Math.min(index, merged.length), 0, def);
  });
  return merged;
}

class ModuleErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Bilan widget render error caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-2 rounded-3xl border border-[#282A30] bg-[#1C1D22] p-5 text-center shadow-sm">
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

/** "Analyse" tab: what happened, with insight cards first and the detailed charts below. */
export const AnalyseTab: React.FC<{
  period: Period;
  referenceDate: Date;
  isConfigOpen: boolean;
  onCloseConfig: () => void;
}> = ({ period, referenceDate, isConfigOpen, onCloseConfig }) => {
  const [modules, setModules] = useState<DashboardModuleConfig[]>(DEFAULT_DASHBOARD_MODULES);

  // Read the customised layout after mount to avoid an SSR hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_CONFIG_STORAGE_KEY);
      if (stored) setModules(mergeModules(JSON.parse(stored))); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      // ignore
    }
  }, []);

  const handleSave = (next: DashboardModuleConfig[]) => {
    setModules(next);
    try {
      localStorage.setItem(DASHBOARD_CONFIG_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const { data: stats } = useDashboardStats(period, referenceDate);
  const { allTasks = [], allCompletions = [] } = useTasks(getTodayDateString());
  const { events: externalEvents = [] } = useCalendarEvents();

  const renderModule = (id: string) => {
    switch (id) {
      case "AT_RISK":
        return <AtRiskCard tasks={allTasks} completions={allCompletions} />;
      case "TIME_DELTAS":
        return (
          <TimeDeltasCard
            tasks={allTasks}
            completions={allCompletions}
            externalEvents={externalEvents}
            period={period}
            referenceDate={referenceDate}
          />
        );
      case "PLANNED_VS_DONE":
        return <PlannedVsDoneCard tasks={allTasks} completions={allCompletions} period={period} referenceDate={referenceDate} />;
      case "FOCUS_HOURS":
        return <FocusHoursCard tasks={allTasks} completions={allCompletions} />;
      case "PROJECT_STATS":
        return (
          <DashboardProjectStatsWidget
            tasks={allTasks}
            externalEvents={externalEvents}
            completions={allCompletions}
            period={period}
            referenceDate={referenceDate}
          />
        );
      case "SLEEP_WAVE":
        return (
          <div className="space-y-4">
            <SleepRegularityCard />
            <SleepWaveChart period={period} referenceDate={referenceDate} />
          </div>
        );
      case "HABITS_VIEW":
        return period === "month" ? (
          <MonthlyHabitCalendar
            tasks={allTasks.filter((t) => t && t.recurrence && t.recurrence !== "ONCE")}
            completions={allCompletions}
            monthDate={referenceDate}
          />
        ) : (
          <StreakGridCard habitStreaks={stats?.habitStreaks || []} dailyStatus={stats?.last7DaysStatus || []} />
        );
      default:
        return null;
    }
  };

  const enabled = modules.filter((m) => m && m.enabled !== false);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {enabled.map((mod) => (
          <div key={mod.id} className="w-full empty:hidden">
            <ModuleErrorBoundary>{renderModule(mod.id)}</ModuleErrorBoundary>
          </div>
        ))}
      </div>
      <DashboardConfigModal isOpen={isConfigOpen} onClose={onCloseConfig} modules={modules} onSave={handleSave} />
    </>
  );
};
