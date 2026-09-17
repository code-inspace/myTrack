"use client";

import React, { useState, useMemo } from "react";
import { useProjects } from "@/features/projects/hooks";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { getExternalEventDurationMinutes } from "@/features/calendar/lib/duration";
import { isExternalEventDone } from "@/features/calendar/lib/status";
import { Period } from "@/features/dashboard/types";
import {
  PieChart as PieChartIcon,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Calendar,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  getISOWeek,
  format,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardProjectStatsWidgetProps {
  tasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  completions?: TaskCompletion[];
  period?: Period;
  referenceDate?: Date;
}

const CATEGORY_COLORS = [
  "#D4F63D",
  "#60A5FA",
  "#F472B6",
  "#34D399",
  "#A78BFA",
  "#F59E0B",
  "#38BDF8",
  "#FB7185",
  "#4ADE80",
];

function getTaskCompletionDurationMinutes(c: TaskCompletion, task?: Task): number {
  if (c.duration && c.duration > 0) return c.duration;
  if (c.actualStartTime && c.actualEndTime) {
    const [h1, m1] = c.actualStartTime.split(":").map(Number);
    const [h2, m2] = c.actualEndTime.split(":").map(Number);
    const diff = h2 * 60 + m2 - (h1 * 60 + m1);
    if (diff > 0) return diff;
  }
  if (task?.startTime && task?.endTime) {
    const [h1, m1] = task.startTime.split(":").map(Number);
    const [h2, m2] = task.endTime.split(":").map(Number);
    const diff = h2 * 60 + m2 - (h1 * 60 + m1);
    if (diff > 0) return diff;
  }
  if (task?.trackingType === "DURATION" && task.targetValue) {
    return Number(task.targetValue);
  }
  if (task?.unit === "min" && task.targetValue) {
    return Number(task.targetValue);
  }
  return 30; // fallback per completed session
}

function getTaskScheduledDurationMinutes(task: Task): number {
  if (task.startTime && task.endTime) {
    const [h1, m1] = task.startTime.split(":").map(Number);
    const [h2, m2] = task.endTime.split(":").map(Number);
    const diff = h2 * 60 + m2 - (h1 * 60 + m1);
    if (diff > 0) return diff;
  }
  if (task.trackingType === "DURATION" && task.targetValue) {
    return Number(task.targetValue);
  }
  if (task.unit === "min" && task.targetValue) {
    return Number(task.targetValue);
  }
  return 30;
}

export function formatDurationHoursMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// Compact format for chart top labels (e.g. 0h, 1h, 1h 30m, 45m)
function formatChartDurationBadge(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0h";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// Compute Y-Axis dynamic grid ticks matching screenshot style
function getYAxisTicks(maxMinutes: number) {
  let step = 30; // 30 mins
  if (maxMinutes > 1200) step = 240; // 4h
  else if (maxMinutes > 600) step = 120; // 2h
  else if (maxMinutes > 300) step = 60; // 1h
  else if (maxMinutes > 150) step = 60; // 1h
  else step = 30; // 30m

  const maxTick = Math.max(Math.ceil((maxMinutes || 0) / step) * step, step * 4);
  const ticks: number[] = [];
  for (let m = maxTick; m >= 0; m -= step) {
    ticks.push(m);
  }
  return { maxTick, ticks, step };
}

function formatTickLabel(minutes: number): string {
  if (minutes === 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function getCoordinatesForPercent(percent: number) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

export interface CategoryTaskDetailItem {
  id: string;
  type: "task" | "event";
  title: string;
  durationMinutes: number;
  isDone: boolean;
  calendarName?: string;
  calendarColor?: string;
}

interface ProjectSlice {
  projectId: string;
  projectName: string;
  projectColor: string;
  minutes: number;
}

interface ChartColumnData {
  id: string;
  title: string;
  subTitle: string;
  fullLabel: string;
  isHighlighted?: boolean;
  projectBreakdown: ProjectSlice[];
  totalMinutes: number;
}

export const DashboardProjectStatsWidget: React.FC<DashboardProjectStatsWidgetProps> = ({
  tasks,
  externalEvents = [],
  completions = [],
  period = "week",
  referenceDate = new Date(),
}) => {
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Period Date Range calculation
  const { startDateStr, endDateStr, periodLabel } = useMemo(() => {
    if (period === "day") {
      const formattedDay = format(referenceDate, "yyyy-MM-dd");
      return {
        startDateStr: formattedDay,
        endDateStr: formattedDay,
        periodLabel: format(referenceDate, "EEEE d MMMM yyyy", { locale: fr }),
      };
    }
    if (period === "week") {
      const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      return {
        startDateStr: format(start, "yyyy-MM-dd"),
        endDateStr: format(end, "yyyy-MM-dd"),
        periodLabel: `Semaine du ${format(start, "dd MMM", { locale: fr })} au ${format(end, "dd MMM", { locale: fr })}`,
      };
    }
    if (period === "month") {
      const start = startOfMonth(referenceDate);
      const end = endOfMonth(referenceDate);
      return {
        startDateStr: format(start, "yyyy-MM-dd"),
        endDateStr: format(end, "yyyy-MM-dd"),
        periodLabel: format(referenceDate, "MMMM yyyy", { locale: fr }),
      };
    }
    return {
      startDateStr: "1970-01-01",
      endDateStr: "2099-12-31",
      periodLabel: "Toutes les dates",
    };
  }, [period, referenceDate]);

  // Map project ID to project object & colors
  const projectMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    projects.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color || "#D4F63D",
      });
    });
    return map;
  }, [projects]);

  // Selected project object for drill-down view
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // All project tasks
  const allProjectTasks = useMemo(() => {
    return tasks.filter((t) => Boolean(t.projectId) && !t.isArchived);
  }, [tasks]);

  // All project external events
  const allProjectEvents = useMemo(() => {
    return externalEvents.filter((e) => Boolean(e.projectId));
  }, [externalEvents]);

  // ================= DAY / DONUT DATA COMPUTATION =================
  const { globalProjectData, totalGlobalMinutes } = useMemo(() => {
    let sumMinutes = 0;
    const isAllPeriod = period === "all";

    const list = projects.map((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id && !t.isArchived);
      const pTaskIds = new Set(pTasks.map((t) => t.id));

      const periodCompletions = completions.filter(
        (c) =>
          pTaskIds.has(c.taskId) &&
          c.completed &&
          (isAllPeriod || (c.date >= startDateStr && c.date <= endDateStr))
      );

      let pMinutes = 0;
      let activeTasksCount = 0;

      for (const t of pTasks) {
        const tComps = periodCompletions.filter((c) => c.taskId === t.id);
        if (tComps.length > 0) {
          activeTasksCount++;
          for (const c of tComps) {
            pMinutes += getTaskCompletionDurationMinutes(c, t);
          }
        } else if (isAllPeriod) {
          activeTasksCount++;
          pMinutes += getTaskScheduledDurationMinutes(t);
        } else if (t.recurrence && t.recurrence !== "ONCE") {
          const dayDate = new Date(startDateStr);
          const dayOfWeek = dayDate.getDay();
          const isWeekDay = dayOfWeek >= 1 && dayOfWeek <= 5;
          const configDays = t.recurrenceConfig?.days || [];
          if (
            t.recurrence === "DAILY" ||
            (t.recurrence === "WEEKDAYS" && isWeekDay) ||
            configDays.includes(dayOfWeek)
          ) {
            activeTasksCount++;
            pMinutes += getTaskScheduledDurationMinutes(t);
          }
        } else {
          const taskDate =
            (t as any).date ||
            t.deadline ||
            (t.createdAt ? t.createdAt.split("T")[0] : null);
          if (taskDate && taskDate >= startDateStr && taskDate <= endDateStr) {
            activeTasksCount++;
            pMinutes += getTaskScheduledDurationMinutes(t);
          }
        }
      }

      const pEvents = externalEvents.filter(
        (e) =>
          e.projectId === p.id &&
          (isAllPeriod || (e.date >= startDateStr && e.date <= endDateStr))
      );

      for (const evt of pEvents) {
        pMinutes += getExternalEventDurationMinutes(evt);
      }

      sumMinutes += pMinutes;

      return {
        id: p.id,
        name: p.name,
        durationMinutes: pMinutes,
        count: activeTasksCount + pEvents.length,
        taskCount: activeTasksCount,
        eventCount: pEvents.length,
        completedInPeriodCount: periodCompletions.length,
        color: p.color || "#D4F63D",
      };
    });

    return { globalProjectData: list, totalGlobalMinutes: sumMinutes };
  }, [projects, tasks, externalEvents, completions, startDateStr, endDateStr, period]);

  // Helper to compute minutes for a specific day dateStr ("yyyy-MM-dd") for Week / Month stacked bar
  const getDayProjectMinutes = useMemo(() => {
    return (dateStr: string) => {
      const breakdownMap = new Map<string, number>();

      const dayCompletions = completions.filter((c) => c.date === dateStr && c.completed);
      const completedTaskIds = new Set(dayCompletions.map((c) => c.taskId));

      for (const c of dayCompletions) {
        const task = tasks.find((t) => t.id === c.taskId && !t.isArchived);
        if (task && task.projectId) {
          const mins = getTaskCompletionDurationMinutes(c, task);
          breakdownMap.set(task.projectId, (breakdownMap.get(task.projectId) || 0) + mins);
        }
      }

      for (const t of tasks) {
        if (!t.projectId || t.isArchived || completedTaskIds.has(t.id)) continue;
        const taskDate =
          (t as any).date ||
          t.deadline ||
          (t.createdAt ? t.createdAt.split("T")[0] : null);

        if (t.recurrence && t.recurrence !== "ONCE") {
          const dayDate = new Date(dateStr);
          const dayOfWeek = dayDate.getDay();
          const isWeekDay = dayOfWeek >= 1 && dayOfWeek <= 5;
          const configDays = t.recurrenceConfig?.days || [];
          if (
            t.recurrence === "DAILY" ||
            (t.recurrence === "WEEKDAYS" && isWeekDay) ||
            configDays.includes(dayOfWeek)
          ) {
            const mins = getTaskScheduledDurationMinutes(t);
            breakdownMap.set(t.projectId, (breakdownMap.get(t.projectId) || 0) + mins);
          }
        } else if (taskDate === dateStr) {
          const mins = getTaskScheduledDurationMinutes(t);
          breakdownMap.set(t.projectId, (breakdownMap.get(t.projectId) || 0) + mins);
        }
      }

      for (const evt of externalEvents) {
        if (evt.projectId && evt.date === dateStr) {
          const mins = getExternalEventDurationMinutes(evt);
          breakdownMap.set(evt.projectId, (breakdownMap.get(evt.projectId) || 0) + mins);
        }
      }

      const slices: ProjectSlice[] = [];
      let totalMins = 0;

      breakdownMap.forEach((mins, pId) => {
        if (mins > 0) {
          const proj = projectMap.get(pId);
          slices.push({
            projectId: pId,
            projectName: proj?.name || "Projet",
            projectColor: proj?.color || "#D4F63D",
            minutes: mins,
          });
          totalMins += mins;
        }
      });

      slices.sort((a, b) => b.minutes - a.minutes);

      return { slices, totalMins };
    };
  }, [tasks, completions, externalEvents, projectMap]);

  // Build Week / Month Chart Columns
  const { columns, totalPeriodMinutes, activeProjectsList } = useMemo(() => {
    const cols: ChartColumnData[] = [];
    let periodSum = 0;
    const projectTotalsMap = new Map<string, number>();

    if (period === "month") {
      const mStart = startOfMonth(referenceDate);
      const mEnd = endOfMonth(referenceDate);
      const weekStarts = eachWeekOfInterval({ start: mStart, end: mEnd }, { weekStartsOn: 1 });

      weekStarts.forEach((wStart) => {
        const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
        const weekNum = getISOWeek(wStart);
        const days = eachDayOfInterval({ start: wStart, end: wEnd });

        const weekBreakdownMap = new Map<string, number>();
        let weekTotal = 0;

        days.forEach((d) => {
          const dStr = format(d, "yyyy-MM-dd");
          const { slices } = getDayProjectMinutes(dStr);
          slices.forEach((s) => {
            weekBreakdownMap.set(
              s.projectId,
              (weekBreakdownMap.get(s.projectId) || 0) + s.minutes
            );
            projectTotalsMap.set(
              s.projectId,
              (projectTotalsMap.get(s.projectId) || 0) + s.minutes
            );
            weekTotal += s.minutes;
          });
        });

        periodSum += weekTotal;

        const weekSlices: ProjectSlice[] = [];
        weekBreakdownMap.forEach((mins, pId) => {
          if (mins > 0) {
            const proj = projectMap.get(pId);
            weekSlices.push({
              projectId: pId,
              projectName: proj?.name || "Projet",
              projectColor: proj?.color || "#D4F63D",
              minutes: mins,
            });
          }
        });
        weekSlices.sort((a, b) => b.minutes - a.minutes);

        cols.push({
          id: `week-${weekNum}-${format(wStart, "yyyy-MM-dd")}`,
          title: `S${weekNum}`,
          subTitle: format(wStart, "dd/MM"),
          fullLabel: `Semaine ${weekNum} (du ${format(wStart, "dd/MM")} au ${format(wEnd, "dd/MM")})`,
          isHighlighted: isSameDay(wStart, startOfWeek(new Date(), { weekStartsOn: 1 })),
          projectBreakdown: weekSlices,
          totalMinutes: weekTotal,
        });
      });
    } else {
      // Week
      const wStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const wEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: wStart, end: wEnd });

      days.forEach((dayDate) => {
        const dStr = format(dayDate, "yyyy-MM-dd");
        const { slices, totalMins } = getDayProjectMinutes(dStr);

        slices.forEach((s) => {
          projectTotalsMap.set(
            s.projectId,
            (projectTotalsMap.get(s.projectId) || 0) + s.minutes
          );
        });

        periodSum += totalMins;

        const dayInitial = format(dayDate, "EEEEE", { locale: fr }).toUpperCase();
        const dayMonth = format(dayDate, "dd/MM");

        const isToday = isSameDay(dayDate, new Date());

        cols.push({
          id: dStr,
          title: dayInitial,
          subTitle: dayMonth,
          fullLabel: format(dayDate, "EEEE d MMMM yyyy", { locale: fr }),
          isHighlighted: isToday,
          projectBreakdown: slices,
          totalMinutes: totalMins,
        });
      });
    }

    const activeProjects: Array<{
      id: string;
      name: string;
      color: string;
      minutes: number;
    }> = [];

    projects.forEach((p) => {
      const mins = projectTotalsMap.get(p.id) || 0;
      activeProjects.push({
        id: p.id,
        name: p.name,
        color: p.color || "#D4F63D",
        minutes: mins,
      });
    });

    activeProjects.sort((a, b) => b.minutes - a.minutes);

    return {
      columns: cols,
      totalPeriodMinutes: periodSum,
      activeProjectsList: activeProjects,
    };
  }, [period, referenceDate, getDayProjectMinutes, projects, projectMap]);

  const maxColumnMinutes = useMemo(() => {
    return Math.max(...columns.map((c) => c.totalMinutes), 0);
  }, [columns]);

  const { maxTick, ticks } = useMemo(() => {
    return getYAxisTicks(maxColumnMinutes);
  }, [maxColumnMinutes]);

  const activeSelectedColumn = useMemo(() => {
    if (!selectedColumnId) return null;
    return columns.find((c) => c.id === selectedColumnId) || null;
  }, [columns, selectedColumnId]);

  // ================= DRILL-DOWN STATS FOR A SINGLE PROJECT =================
  const selectedProjectStats = useMemo(() => {
    if (!selectedProject) return null;

    const pTasks = tasks.filter((t) => t.projectId === selectedProject.id && !t.isArchived);
    const pTaskIds = new Set(pTasks.map((t) => t.id));

    let pStart = startDateStr;
    let pEnd = endDateStr;

    const pEvents = externalEvents.filter(
      (e) => e.projectId === selectedProject.id && e.date >= pStart && e.date <= pEnd
    );

    const periodCompletions = completions.filter(
      (c) =>
        pTaskIds.has(c.taskId) &&
        c.completed &&
        c.date >= pStart &&
        c.date <= pEnd
    );

    const catMap: Record<
      string,
      { durationMinutes: number; count: number; completedCount: number; items: CategoryTaskDetailItem[] }
    > = {};

    const projectCategories = Array.isArray(selectedProject.categories)
      ? [...selectedProject.categories]
      : [];
    if (!projectCategories.includes("Général")) {
      projectCategories.unshift("Général");
    }

    for (const cat of projectCategories) {
      catMap[cat] = { durationMinutes: 0, count: 0, completedCount: 0, items: [] };
    }

    let projectTotalMinutes = 0;
    let includedTasksCount = 0;
    let completedTasksCount = 0;

    for (const t of pTasks) {
      const cat = t.projectCategory || "Général";
      if (!catMap[cat]) {
        catMap[cat] = { durationMinutes: 0, count: 0, completedCount: 0, items: [] };
      }

      const tComps = periodCompletions.filter((c) => c.taskId === t.id);
      let tMins = 0;
      let isIncluded = false;
      let isDone = false;

      if (tComps.length > 0) {
        isIncluded = true;
        isDone = true;
        for (const c of tComps) {
          tMins += getTaskCompletionDurationMinutes(c, t);
        }
      } else {
        const taskDate =
          (t as any).date ||
          t.deadline ||
          (t.createdAt ? t.createdAt.split("T")[0] : null);
        if (taskDate && taskDate >= pStart && taskDate <= pEnd) {
          isIncluded = true;
          isDone = t.projectStatus === "DONE";
          tMins = getTaskScheduledDurationMinutes(t);
        }
      }

      if (isIncluded) {
        includedTasksCount++;
        catMap[cat].count++;
        catMap[cat].durationMinutes += tMins;
        projectTotalMinutes += tMins;
        if (isDone) {
          completedTasksCount++;
          catMap[cat].completedCount++;
        }
        catMap[cat].items.push({
          id: t.id,
          type: "task",
          title: t.title,
          durationMinutes: tMins,
          isDone,
        });
      }
    }

    for (const evt of pEvents) {
      const cat = evt.projectCategory || "Général";
      if (!catMap[cat]) {
        catMap[cat] = { durationMinutes: 0, count: 0, completedCount: 0, items: [] };
      }
      catMap[cat].count++;
      const evtMins = getExternalEventDurationMinutes(evt);
      const isDone = isExternalEventDone(evt);
      if (isDone) {
        catMap[cat].completedCount++;
        completedTasksCount++;
      }
      catMap[cat].durationMinutes += evtMins;
      projectTotalMinutes += evtMins;
      catMap[cat].items.push({
        id: evt.id,
        type: "event",
        title: evt.title,
        durationMinutes: evtMins,
        isDone,
        calendarName: evt.calendarName,
        calendarColor: evt.calendarColor,
      });
    }

    const categoriesList = Object.keys(catMap).map((catName, idx) => {
      const sortedItems = [...catMap[catName].items].sort(
        (a, b) => b.durationMinutes - a.durationMinutes
      );
      return {
        id: catName,
        name: catName,
        durationMinutes: catMap[catName].durationMinutes,
        count: catMap[catName].count,
        completedCount: catMap[catName].completedCount,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        items: sortedItems,
      };
    });

    return {
      tasks: pTasks,
      events: pEvents,
      totalCount: includedTasksCount + pEvents.length,
      projectTotalMinutes,
      completedTasksCount,
      completionRate:
        includedTasksCount + pEvents.length > 0
          ? Math.round((completedTasksCount / (includedTasksCount + pEvents.length)) * 100)
          : 0,
      categoriesList,
    };
  }, [selectedProject, tasks, externalEvents, completions, startDateStr, endDateStr]);

  // Donut cumulative math for day mode
  let globalCumulativePercent = 0;
  const effectiveGlobalTotal =
    totalGlobalMinutes > 0 ? totalGlobalMinutes : allProjectTasks.length + allProjectEvents.length;

  const toggleExpandCategory = (catId: string) => {
    setExpandedCategory((prev) => (prev === catId ? null : catId));
  };

  const chartHeightPx = 220;

  return (
    <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
      {/* 1. Widget Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {selectedProject ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                setExpandedCategory(null);
              }}
              className="p-1.5 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#8E929E] hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Retour au graphique global"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#D4F63D]" />
              <span>Tous les projets</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                style={{ backgroundColor: selectedProject.color }}
              />
              <h3 className="text-sm font-bold text-white truncate max-w-[180px]">
                {selectedProject.name}
              </h3>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {period === "day" ? (
              <PieChartIcon className="w-4 h-4 text-[#D4F63D]" />
            ) : (
              <h3 className="text-sm font-bold text-white tracking-tight">Temps enregistré</h3>
            )}
            <h3 className="text-sm font-bold text-white">
              {period === "day" ? "Répartition des Projets" : ""}
            </h3>
            <span className="text-[11px] font-semibold text-[#8E929E]">
              ({period === "day" ? "Jour" : period === "week" ? "Semaine" : "Mois"})
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-0.5 rounded-full bg-[#252830] text-[#D4F63D] font-bold text-xs border border-white/5">
            Total : {formatDurationHoursMinutes(period === "day" ? totalGlobalMinutes : totalPeriodMinutes)}
          </div>
          <Link
            href="/projects"
            className="text-xs text-[#8E929E] hover:text-[#D4F63D] flex items-center gap-0.5 transition-colors"
          >
            <span>Gérer</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#8E929E]">
          Aucun projet créé pour l&apos;instant.
        </div>
      ) : selectedProject && selectedProjectStats ? (
        /* ================= SINGLE PROJECT DETAIL VIEW ================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-2xl bg-[#252830]/80 border border-[#343740] flex flex-col items-center text-center">
              <span className="text-[10px] text-[#8E929E] uppercase font-bold tracking-wider">
                Temps passé
              </span>
              <span className="text-sm md:text-base font-black text-[#D4F63D] mt-0.5">
                {formatDurationHoursMinutes(selectedProjectStats.projectTotalMinutes)}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#252830]/80 border border-[#343740] flex flex-col items-center text-center">
              <span className="text-[10px] text-[#8E929E] uppercase font-bold tracking-wider">
                Éléments
              </span>
              <span className="text-sm md:text-base font-black text-white mt-0.5">
                {selectedProjectStats.totalCount}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#252830]/80 border border-[#343740] flex flex-col items-center text-center">
              <span className="text-[10px] text-[#8E929E] uppercase font-bold tracking-wider">
                Progression
              </span>
              <span className="text-sm md:text-base font-black text-[#60A5FA] mt-0.5">
                {selectedProjectStats.completionRate}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E929E] pb-1 border-b border-[#282A30]">
              <span>Sous-catégorie</span>
              <span>Temps & Détail</span>
            </div>

            {selectedProjectStats.categoriesList.map((cat) => {
              const isExpanded = expandedCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  className={cn(
                    "rounded-2xl border transition-all overflow-hidden",
                    isExpanded
                      ? "bg-[#21232B] border-[#D4F63D]/40 shadow-md"
                      : "bg-[#181A20] border-[#262832] hover:border-[#363946]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpandCategory(cat.id)}
                    className="w-full flex items-center justify-between text-xs p-2.5 cursor-pointer text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-white truncate font-bold text-xs">{cat.name}</span>
                      <span className="text-[10px] text-[#8E929E] bg-[#252832] px-1.5 py-0.2 rounded-md">
                        {cat.count}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold text-[#D4F63D]">
                        {formatDurationHoursMinutes(cat.durationMinutes)}
                      </span>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-lg bg-[#282B36] flex items-center justify-center text-[#8E929E] transition-transform duration-200",
                          isExpanded ? "rotate-90 text-[#D4F63D]" : ""
                        )}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-[#2A2D3A] bg-[#14151B] space-y-1.5 animate-in fade-in duration-200">
                      {cat.items.length === 0 ? (
                        <div className="text-[11px] text-[#6B7280] italic py-2 text-center">
                          Aucune tâche ni événement dans cette sous-catégorie
                        </div>
                      ) : (
                        cat.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-2 rounded-xl bg-[#1D1F27] border border-[#282B38] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {item.type === "event" ? (
                                <Calendar className="w-3 h-3 text-[#3B82F6] flex-shrink-0" />
                              ) : item.isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#D4F63D] flex-shrink-0" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                              )}
                              <span
                                className={cn(
                                  "text-xs truncate",
                                  item.isDone ? "text-[#9CA3AF] line-through" : "text-white"
                                )}
                              >
                                {item.title}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#D4F63D] flex-shrink-0">
                              {formatDurationHoursMinutes(item.durationMinutes)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : period === "day" ? (
        /* ================= DAY PERIOD: DONUT / CAMEMBERT VIEW ================= */
        <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in duration-200">
          {/* Global Donut Chart based on duration */}
          <div className="relative w-36 h-36 flex-shrink-0 select-none">
            <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full -rotate-90">
              {effectiveGlobalTotal === 0 ? (
                <circle
                  cx="0"
                  cy="0"
                  r="0.8"
                  fill="transparent"
                  stroke="#282A30"
                  strokeWidth="0.3"
                />
              ) : (
                globalProjectData.map((slice, idx) => {
                  const sliceValue =
                    totalGlobalMinutes > 0 ? slice.durationMinutes : slice.count;
                  if (sliceValue === 0) return null;
                  const percent = sliceValue / effectiveGlobalTotal;
                  const [startX, startY] = getCoordinatesForPercent(globalCumulativePercent);
                  globalCumulativePercent += percent;
                  const [endX, endY] = getCoordinatesForPercent(globalCumulativePercent);
                  const isLargeArc = percent > 0.5 ? 1 : 0;
                  const isHovered = hoveredIndex === idx;

                  if (percent >= 0.999) {
                    return (
                      <circle
                        key={slice.id}
                        cx="0"
                        cy="0"
                        r="0.8"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth={isHovered ? "0.36" : "0.3"}
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => setSelectedProjectId(slice.id)}
                        style={{
                          filter: isHovered ? `drop-shadow(0 0 8px ${slice.color})` : "none",
                        }}
                      />
                    );
                  }

                  const pathData = [
                    `M ${startX * 0.95} ${startY * 0.95}`,
                    `A 0.95 0.95 0 ${isLargeArc} 1 ${endX * 0.95} ${endY * 0.95}`,
                    `L ${endX * 0.65} ${endY * 0.65}`,
                    `A 0.65 0.65 0 ${isLargeArc} 0 ${startX * 0.65} ${startY * 0.65}`,
                    "Z",
                  ].join(" ");

                  return (
                    <path
                      key={slice.id}
                      d={pathData}
                      fill={slice.color}
                      className={cn(
                        "transition-all duration-200 cursor-pointer",
                        isHovered ? "opacity-100 scale-105" : "opacity-90 hover:opacity-100"
                      )}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setSelectedProjectId(slice.id)}
                      style={{
                        transformOrigin: "0 0",
                        filter: isHovered ? `drop-shadow(0 0 10px ${slice.color})` : "none",
                      }}
                    />
                  );
                })
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              {hoveredIndex !== null && globalProjectData[hoveredIndex] ? (
                <>
                  <span className="text-sm font-black text-white leading-none">
                    {formatDurationHoursMinutes(globalProjectData[hoveredIndex].durationMinutes)}
                  </span>
                  <span className="text-[10px] text-[#D4F63D] font-bold mt-0.5 truncate max-w-[90px]">
                    {globalProjectData[hoveredIndex].name}
                  </span>
                  <span className="text-[9px] text-[#8E929E]">
                    ({globalProjectData[hoveredIndex].count} élém.)
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base font-black text-white leading-none">
                    {formatDurationHoursMinutes(totalGlobalMinutes)}
                  </span>
                  <span className="text-[10px] text-[#D4F63D] font-bold mt-0.5">
                    {allProjectTasks.length + allProjectEvents.length} élément
                    {allProjectTasks.length + allProjectEvents.length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Project List with duration & click-to-drilldown */}
          <div className="flex-1 w-full space-y-1.5">
            <div className="text-[10px] font-semibold text-[#8E929E] flex items-center justify-between pb-1">
              <span>Projet (clique pour détails)</span>
              <span>Temps & Part</span>
            </div>

            {globalProjectData.map((p, idx) => {
              const percent =
                effectiveGlobalTotal > 0
                  ? Math.round(
                      ((totalGlobalMinutes > 0 ? p.durationMinutes : p.count) /
                        effectiveGlobalTotal) *
                        100
                    )
                  : 0;
              const isHovered = hoveredIndex === idx;

              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={cn(
                    "w-full flex items-center justify-between text-xs p-1.5 rounded-xl transition-all cursor-pointer text-left group",
                    isHovered ? "bg-white/10 shadow-sm" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-white truncate font-medium group-hover:text-[#D4F63D] transition-colors">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-[#D4F63D]">
                      {formatDurationHoursMinutes(p.durationMinutes)}
                    </span>
                    <span className="text-[10px] text-[#8E929E]">({p.count} élém.)</span>
                    <span className="text-[10px] text-[#6B7280] w-7 text-right">{percent}%</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6B7280] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= WEEK / MONTH: MAIN VERTICAL STACKED BAR CHART ================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Chart Frame matching screenshot design */}
          <div className="relative w-full rounded-2xl bg-[#141519] border border-[#282A30] p-4 select-none overflow-hidden">
            {/* Chart Area */}
            <div className="relative flex" style={{ height: `${chartHeightPx}px` }}>
              {/* Left Y-Axis labels */}
              <div className="w-12 h-full flex flex-col justify-between py-1 pr-2 flex-shrink-0 select-none z-10">
                {ticks.map((tick, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono font-medium text-[#8E929E] text-right"
                  >
                    {formatTickLabel(tick)}
                  </span>
                ))}
              </div>

              {/* Horizontal Gridlines spanning across chart */}
              <div className="absolute inset-0 left-12 right-2 pointer-events-none z-0">
                {ticks.map((tick, idx) => {
                  const topPct = (idx / (ticks.length - 1)) * 100;
                  return (
                    <div
                      key={idx}
                      className="absolute inset-x-0 border-b border-dashed border-[#242732]"
                      style={{ top: `${topPct}%` }}
                    />
                  );
                })}
              </div>

              {/* Stacked Vertical Bar Columns */}
              <div className="relative flex-1 h-full flex items-end justify-around gap-2 z-10 pl-2">
                {columns.map((col) => {
                  const isSelected = selectedColumnId === col.id;
                  const barHeightPct =
                    maxTick > 0 ? (col.totalMinutes / maxTick) * 100 : 0;

                  return (
                    <div
                      key={col.id}
                      onClick={() =>
                        setSelectedColumnId((prev) => (prev === col.id ? null : col.id))
                      }
                      className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group min-w-0"
                    >
                      {/* Top duration label over the bar (e.g. 1h or 0h) */}
                      <span
                        className={cn(
                          "text-[10px] font-mono mb-1.5 transition-colors text-center whitespace-nowrap",
                          col.totalMinutes > 0
                            ? isSelected
                              ? "font-bold text-[#D4F63D]"
                              : "font-bold text-white group-hover:text-[#D4F63D]"
                            : "font-medium text-[#6B7280]"
                        )}
                      >
                        {formatChartDurationBadge(col.totalMinutes)}
                      </span>

                      {/* Stacked Bar Container */}
                      <div
                        className={cn(
                          "w-full max-w-[22px] sm:max-w-[26px] min-h-[2px] rounded-t-md transition-all relative overflow-hidden flex flex-col justify-end",
                          isSelected
                            ? "ring-2 ring-[#D4F63D] shadow-lg shadow-[#D4F63D]/20 scale-105"
                            : "group-hover:opacity-90"
                        )}
                        style={{
                          height: `${Math.max(barHeightPct, 0.8)}%`,
                          backgroundColor:
                            col.totalMinutes === 0 ? "transparent" : undefined,
                        }}
                      >
                        {col.projectBreakdown.map((slice) => {
                          const sliceHeightPct =
                            col.totalMinutes > 0
                              ? (slice.minutes / col.totalMinutes) * 100
                              : 0;

                          return (
                            <div
                              key={slice.projectId}
                              className="w-full transition-all"
                              style={{
                                height: `${sliceHeightPct}%`,
                                backgroundColor: slice.projectColor,
                              }}
                              title={`${slice.projectName}: ${formatDurationHoursMinutes(slice.minutes)}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Baseline border */}
            <div className="ml-12 border-t border-[#343743] mt-0.5" />

            {/* X-Axis labels underneath columns */}
            <div className="ml-12 flex items-start justify-around gap-2 pt-2">
              {columns.map((col) => {
                const isSelected = selectedColumnId === col.id;

                return (
                  <div
                    key={col.id}
                    onClick={() =>
                      setSelectedColumnId((prev) => (prev === col.id ? null : col.id))
                    }
                    className="flex-1 flex flex-col items-center text-center cursor-pointer group min-w-0"
                  >
                    <span
                      className={cn(
                        "text-[11px] font-semibold leading-tight truncate max-w-full transition-colors",
                        isSelected || col.isHighlighted
                          ? "text-[#D4F63D] font-bold"
                          : "text-white/90 group-hover:text-white"
                      )}
                    >
                      {col.title}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] text-[#8E929E] leading-tight truncate max-w-full mt-0.5 transition-colors",
                        isSelected ? "text-white font-semibold" : "group-hover:text-[#CBD5E1]"
                      )}
                    >
                      {col.subTitle}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project List underneath matching Day view format and adapting to clicked column */}
          <div className="w-full space-y-1.5 pt-1">
            <div className="text-[10px] font-semibold text-[#8E929E] flex items-center justify-between pb-1 border-b border-[#282A30]">
              {activeSelectedColumn ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white font-bold capitalize truncate text-xs">
                    {activeSelectedColumn.fullLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedColumnId(null)}
                    className="text-[10px] text-[#818CF8] hover:text-[#A5B4FC] hover:underline cursor-pointer flex-shrink-0"
                  >
                    (Voir toute la {period === "month" ? "période" : "semaine"})
                  </button>
                </div>
              ) : (
                <span>Projet (clique pour détails)</span>
              )}
              <span className="font-bold text-[#D4F63D]">
                {activeSelectedColumn
                  ? `Total : ${formatDurationHoursMinutes(activeSelectedColumn.totalMinutes)}`
                  : "Temps & Part"}
              </span>
            </div>

            {(() => {
              const displayedItems = activeSelectedColumn
                ? activeSelectedColumn.projectBreakdown.map((s) => ({
                    id: s.projectId,
                    name: s.projectName,
                    color: s.projectColor,
                    durationMinutes: s.minutes,
                    percent:
                      activeSelectedColumn.totalMinutes > 0
                        ? Math.round((s.minutes / activeSelectedColumn.totalMinutes) * 100)
                        : 0,
                  }))
                : activeProjectsList
                    .filter((p) => p.minutes > 0)
                    .map((p) => ({
                      id: p.id,
                      name: p.name,
                      color: p.color,
                      durationMinutes: p.minutes,
                      percent:
                        totalPeriodMinutes > 0
                          ? Math.round((p.minutes / totalPeriodMinutes) * 100)
                          : 0,
                    }));

              if (displayedItems.length === 0) {
                return (
                  <div className="py-4 text-center text-xs text-[#8E929E] italic">
                    Aucun temps enregistré {activeSelectedColumn ? "pour ce jour" : "sur cette période"}.
                  </div>
                );
              }

              return displayedItems.map((p, idx) => {
                const isHovered = hoveredIndex === idx;

                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={cn(
                      "w-full flex items-center justify-between text-xs p-2 rounded-xl transition-all cursor-pointer text-left group",
                      isHovered ? "bg-white/10 shadow-sm" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-white truncate font-medium group-hover:text-[#D4F63D] transition-colors">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold text-[#D4F63D]">
                        {formatDurationHoursMinutes(p.durationMinutes)}
                      </span>
                      <span className="text-[10px] text-[#6B7280] w-7 text-right font-mono">
                        {p.percent}%
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#6B7280] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
