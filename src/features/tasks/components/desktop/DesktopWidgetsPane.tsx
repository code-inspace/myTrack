"use client";

import React, { useMemo } from "react";
import { TaskWithCompletion, Task } from "@/features/tasks/types";
import {
  Compass,
  Flame,
  Clock,
  Moon,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  FolderKanban,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { ExternalCalendarEvent } from "@/features/calendar/types";
import { getExternalEventStatus } from "@/features/calendar/lib/status";
import { useProjects } from "@/features/projects/hooks";

interface UpcomingItem {
  id: string;
  title: string;
  time: string;
  color: string;
  isExternal: boolean;
  hasProject: boolean;
}

interface DesktopWidgetsPaneProps {
  tasks: TaskWithCompletion[];
  allTasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  activeTask?: TaskWithCompletion | Task;
  selectedDate: string;
  sleepDurationText?: string;
  onOpenNewTask?: () => void;
  onSelectTab?: (tab: any) => void;
}

export const DesktopWidgetsPane: React.FC<DesktopWidgetsPaneProps> = ({
  tasks,
  allTasks,
  externalEvents = [],
  activeTask,
  selectedDate,
  sleepDurationText,
  onOpenNewTask,
  onSelectTab,
}) => {
  const { projects } = useProjects();
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.isCompletedToday).length;
  const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Upcoming scheduled tasks and external calendar events
  const upcomingTasks = useMemo<UpcomingItem[]>(() => {
    const taskItems: UpcomingItem[] = tasks
      .filter((t) => !t.isCompletedToday && (t.effectiveStartTime || t.startTime))
      .map((t) => {
        const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
        return {
          id: t.id,
          title: t.title,
          time: t.effectiveStartTime || t.startTime || "",
          color: project?.color || "#38BDF8",
          isExternal: false,
          hasProject: Boolean(project),
        };
      });

    const eventItems: UpcomingItem[] = externalEvents
      .filter((e) => getExternalEventStatus(e, selectedDate) !== "DONE" && e.startTime)
      .map((e) => {
        const project = e.projectId ? projects.find((p) => p.id === e.projectId) : null;
        return {
          id: e.id,
          title: e.title,
          time: e.startTime || "",
          color: project?.color || e.calendarColor || "#3B82F6",
          isExternal: true,
          hasProject: Boolean(project),
        };
      });

    return [...taskItems, ...eventItems]
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 4);
  }, [tasks, externalEvents, selectedDate, projects]);

  // Projects count
  const projectTasks = allTasks.filter((t) => t.projectId && !t.isArchived);

  return (
    <aside className="hidden xl:flex flex-col gap-4 w-80 2xl:w-96 flex-shrink-0 select-none overflow-y-auto scrollbar-none pr-1 pb-10">
      {/* 1. Master Gauge Card (Speedometer / Compass aesthetic from reference) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#181A22] to-[#121317] border border-[#262834] p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4F63D]/10 border border-[#D4F63D]/25 flex items-center justify-center text-[#D4F63D]">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Rythme & Discipline</h3>
              <p className="text-[10px] text-[#8E929E]">Score de progression du jour</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#D4F63D]/15 text-[#D4F63D] border border-[#D4F63D]/30 text-[11px] font-mono font-bold">
            {rate}%
          </span>
        </div>

        {/* Dual Gauges Grid (inspired by Speed + Fuel gauges in reference) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Gauge 1: Execution Rate */}
          <div className="bg-[#1C1E26] border border-[#2B2E3C] rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="relative w-20 h-20 flex items-center justify-center my-1">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#252834]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#D4F63D] transition-all duration-1000 ease-out"
                  strokeDasharray={`${rate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold font-mono text-white">{rate}%</span>
              </div>
            </div>
            <span className="text-[10px] font-medium text-[#8E929E] mt-1">Complétion</span>
          </div>

          {/* Gauge 2: Total Completed Ratio */}
          <div className="bg-[#1C1E26] border border-[#2B2E3C] rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="relative w-20 h-20 flex items-center justify-center my-1">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#252834]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#38BDF8] transition-all duration-1000 ease-out"
                  strokeDasharray={`${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold font-mono text-white">
                  {completedCount}/{totalCount}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-medium text-[#8E929E] mt-1">Victoires</span>
          </div>
        </div>

        {/* Status Bar */}
        <div className="p-2.5 rounded-2xl bg-[#1A1C24] border border-[#292B38] flex items-center justify-between text-xs">
          <span className="text-[#8E929E] flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#D4F63D]" />
            {rate === 100 ? "Journée 100% accomplie !" : rate >= 50 ? "Super rythme en cours" : "Prêt à démarrer"}
          </span>
          <span className="font-mono text-[#D4F63D] font-bold text-[11px]">
            {completedCount}/{totalCount} fait
          </span>
        </div>
      </div>

      {/* 2. Upcoming Agenda Slots Today */}
      <div className="rounded-3xl bg-[#15161B] border border-[#242630] p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#38BDF8]" />
            Prochains créneaux
          </h3>
          <button
            type="button"
            onClick={() => onSelectTab?.("agenda")}
            className="text-[11px] font-medium text-[#38BDF8] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            Agenda <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {upcomingTasks.length === 0 ? (
          <div className="p-3 rounded-2xl bg-[#1B1C22] border border-[#282A34] text-center">
            <p className="text-[11px] text-[#8E929E]">Aucun créneau restant aujourd&apos;hui</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingTasks.map((t) => (
              <div
                key={t.id}
                style={
                  t.hasProject && t.color
                    ? {
                        borderColor: `${t.color}45`,
                        backgroundColor: `${t.color}0F`,
                      }
                    : undefined
                }
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-2xl bg-[#1C1E26] border border-[#2A2D3A] text-xs hover:border-[#3E4254] transition-all",
                  t.hasProject && "hover:brightness-110"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="font-medium text-white truncate text-xs">{t.title}</span>
                </div>
                <span className="font-mono text-[10px] text-[#8E929E] bg-[#222530] px-2 py-0.5 rounded-md flex-shrink-0 ml-2">
                  {t.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Sleep & Recovery Mini Card */}
      {sleepDurationText && (
        <div className="rounded-3xl bg-[#15161B] border border-[#242630] p-4 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#818CF8]/10 border border-[#818CF8]/25 flex items-center justify-center text-[#818CF8]">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Sommeil dernière nuit</h4>
              <p className="text-[11px] font-mono text-[#818CF8] font-semibold">{sleepDurationText}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab?.("sleep")}
            className="p-2 rounded-xl bg-[#1F212B] hover:bg-[#282B38] text-[#8E929E] hover:text-white transition-all cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Projects Status Banner */}
      <div className="rounded-3xl bg-[#15161B] border border-[#242630] p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#F97316]/10 border border-[#F97316]/25 flex items-center justify-center text-[#F97316]">
            <FolderKanban className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Tableau Projets</h4>
            <p className="text-[11px] text-[#8E929E]">{projectTasks.length} tâches rattachées</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectTab?.("projects")}
          className="p-2 rounded-xl bg-[#1F212B] hover:bg-[#282B38] text-[#8E929E] hover:text-white transition-all cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
