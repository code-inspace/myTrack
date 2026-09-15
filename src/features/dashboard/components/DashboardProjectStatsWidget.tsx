"use client";

import React, { useState, useMemo } from "react";
import { useProjects } from "@/features/projects/hooks";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { Period } from "@/features/dashboard/types";
import { getProjectColumns } from "@/features/projects/types";
import {
  PieChart as PieChartIcon,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Tag,
  FolderKanban,
  Layers,
  Sparkles,
  Calendar,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardProjectStatsWidgetProps {
  tasks: Task[];
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

function formatDurationHoursMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getCoordinatesForPercent(percent: number) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

export const DashboardProjectStatsWidget: React.FC<DashboardProjectStatsWidgetProps> = ({
  tasks,
  completions = [],
  period = "week",
  referenceDate = new Date(),
}) => {
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Period Date Range calculation
  const { startDateStr, endDateStr, periodLabel } = useMemo(() => {
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

  // Selected project object
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // All project tasks
  const allProjectTasks = useMemo(() => {
    return tasks.filter((t) => Boolean(t.projectId) && !t.isArchived);
  }, [tasks]);

  // Global Project distribution chart data with duration & task counts
  const { globalProjectData, totalGlobalMinutes } = useMemo(() => {
    let sumMinutes = 0;
    const list = projects.map((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id && !t.isArchived);
      const pTaskIds = new Set(pTasks.map((t) => t.id));

      const periodCompletions = completions.filter(
        (c) =>
          pTaskIds.has(c.taskId) &&
          c.completed &&
          c.date >= startDateStr &&
          c.date <= endDateStr
      );

      let pMinutes = 0;
      if (periodCompletions.length > 0) {
        for (const c of periodCompletions) {
          const t = pTasks.find((item) => item.id === c.taskId);
          pMinutes += getTaskCompletionDurationMinutes(c, t);
        }
      } else {
        for (const t of pTasks) {
          pMinutes += getTaskScheduledDurationMinutes(t);
        }
      }

      sumMinutes += pMinutes;

      return {
        id: p.id,
        name: p.name,
        durationMinutes: pMinutes,
        count: pTasks.length,
        completedInPeriodCount: periodCompletions.length,
        color: p.color || "#D4F63D",
      };
    });

    return { globalProjectData: list, totalGlobalMinutes: sumMinutes };
  }, [projects, tasks, completions, startDateStr, endDateStr]);

  // Detailed computations for selected project
  const selectedProjectStats = useMemo(() => {
    if (!selectedProject) return null;

    const pTasks = tasks.filter((t) => t.projectId === selectedProject.id && !t.isArchived);
    const pTaskIds = new Set(pTasks.map((t) => t.id));

    // Completions inside the selected period
    const periodCompletions = completions.filter(
      (c) =>
        pTaskIds.has(c.taskId) &&
        c.completed &&
        c.date >= startDateStr &&
        c.date <= endDateStr
    );

    // Categories breakdown
    const catMap: Record<string, { durationMinutes: number; count: number; completedCount: number }> = {};
    const projectCategories = Array.isArray(selectedProject.categories)
      ? [...selectedProject.categories]
      : [];
    if (!projectCategories.includes("Général")) {
      projectCategories.unshift("Général");
    }

    for (const cat of projectCategories) {
      catMap[cat] = { durationMinutes: 0, count: 0, completedCount: 0 };
    }

    let projectTotalMinutes = 0;

    for (const t of pTasks) {
      const cat = t.projectCategory || "Général";
      if (!catMap[cat]) {
        catMap[cat] = { durationMinutes: 0, count: 0, completedCount: 0 };
      }
      catMap[cat].count++;

      const tComps = periodCompletions.filter((c) => c.taskId === t.id);
      let tMins = 0;
      if (tComps.length > 0) {
        catMap[cat].completedCount += tComps.length;
        for (const c of tComps) {
          tMins += getTaskCompletionDurationMinutes(c, t);
        }
      } else {
        tMins = getTaskScheduledDurationMinutes(t);
      }

      catMap[cat].durationMinutes += tMins;
      projectTotalMinutes += tMins;
    }

    const categoriesList = Object.keys(catMap).map((catName, idx) => ({
      id: catName,
      name: catName,
      durationMinutes: catMap[catName].durationMinutes,
      count: catMap[catName].count,
      completedCount: catMap[catName].completedCount,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));

    // Status columns breakdown
    const columns = getProjectColumns(selectedProject);
    const columnsList = columns.map((col) => {
      const colTasks = pTasks.filter((t) => t.projectStatus === col.id);
      return {
        id: col.id,
        label: col.label,
        isDone: Boolean(col.isDone),
        count: colTasks.length,
      };
    });

    const completedTasksCount = pTasks.filter(
      (t) =>
        t.projectStatus === "DONE" ||
        periodCompletions.some((c) => c.taskId === t.id)
    ).length;

    const completionRate =
      pTasks.length > 0
        ? Math.round((completedTasksCount / pTasks.length) * 100)
        : 0;

    return {
      tasks: pTasks,
      totalCount: pTasks.length,
      projectTotalMinutes,
      periodCompletionsCount: periodCompletions.length,
      completedTasksCount,
      completionRate,
      categoriesList,
      columnsList,
    };
  }, [selectedProject, tasks, completions, startDateStr, endDateStr]);

  // Global Donut Chart Cumulative Angles based on duration (or tasks fallback)
  let globalCumulativePercent = 0;
  const effectiveGlobalTotal = totalGlobalMinutes > 0 ? totalGlobalMinutes : allProjectTasks.length;

  // Detail Category Donut Cumulative Angles based on duration (or tasks fallback)
  let detailCumulativePercent = 0;
  const effectiveDetailTotal =
    selectedProjectStats && selectedProjectStats.projectTotalMinutes > 0
      ? selectedProjectStats.projectTotalMinutes
      : selectedProjectStats?.totalCount || 0;

  return (
    <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
      {/* Widget Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {selectedProject ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                setHoveredIndex(null);
              }}
              className="p-1.5 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#8E929E] hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Retour au camembert global"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#D4F63D]" />
              <span>Projets</span>
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
            <PieChartIcon className="w-4 h-4 text-[#D4F63D]" />
            <h3 className="text-sm font-bold text-white">Répartition des Projets</h3>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#252830] text-[#8E929E] border border-white/5">
            {period === "week" ? "Semaine" : period === "month" ? "Mois" : "Global"}
          </span>
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
        <div className="py-6 text-center text-xs text-[#8E929E]">
          Aucun projet créé pour l&apos;instant.
        </div>
      ) : selectedProject && selectedProjectStats ? (
        /* ================= SELECTED PROJECT DRILL-DOWN VIEW ================= */
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Period Stats KPI Banner */}
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
                Tâches
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

          {/* Category Donut + Category Breakdown based on duration */}
          <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
            {/* Donut Chart: Categories by duration */}
            <div className="relative w-36 h-36 flex-shrink-0 select-none">
              <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full -rotate-90">
                {effectiveDetailTotal === 0 ? (
                  <circle
                    cx="0"
                    cy="0"
                    r="0.8"
                    fill="transparent"
                    stroke="#282A30"
                    strokeWidth="0.3"
                  />
                ) : (
                  selectedProjectStats.categoriesList.map((cat, idx) => {
                    const sliceValue =
                      selectedProjectStats.projectTotalMinutes > 0
                        ? cat.durationMinutes
                        : cat.count;
                    if (sliceValue === 0) return null;
                    const percent = sliceValue / effectiveDetailTotal;
                    const [startX, startY] = getCoordinatesForPercent(detailCumulativePercent);
                    detailCumulativePercent += percent;
                    const [endX, endY] = getCoordinatesForPercent(detailCumulativePercent);
                    const isLargeArc = percent > 0.5 ? 1 : 0;
                    const isHovered = hoveredIndex === idx;

                    if (percent >= 0.999) {
                      return (
                        <circle
                          key={cat.id}
                          cx="0"
                          cy="0"
                          r="0.8"
                          fill="transparent"
                          stroke={cat.color}
                          strokeWidth={isHovered ? "0.36" : "0.3"}
                          className="transition-all duration-200 cursor-pointer"
                          onMouseEnter={() => setHoveredIndex(idx)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          style={{
                            filter: isHovered ? `drop-shadow(0 0 8px ${cat.color})` : "none",
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
                        key={cat.id}
                        d={pathData}
                        fill={cat.color}
                        className={cn(
                          "transition-all duration-200 cursor-pointer",
                          isHovered ? "opacity-100 scale-105" : "opacity-90 hover:opacity-100"
                        )}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{
                          transformOrigin: "0 0",
                          filter: isHovered ? `drop-shadow(0 0 10px ${cat.color})` : "none",
                        }}
                      />
                    );
                  })
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                {hoveredIndex !== null && selectedProjectStats.categoriesList[hoveredIndex] ? (
                  <>
                    <span className="text-sm font-black text-white leading-none">
                      {formatDurationHoursMinutes(
                        selectedProjectStats.categoriesList[hoveredIndex].durationMinutes
                      )}
                    </span>
                    <span className="text-[10px] text-[#D4F63D] font-bold mt-0.5 truncate max-w-[90px]">
                      {selectedProjectStats.categoriesList[hoveredIndex].name}
                    </span>
                    <span className="text-[9px] text-[#8E929E]">
                      ({selectedProjectStats.categoriesList[hoveredIndex].count} t.)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-base font-black text-white leading-none">
                      {formatDurationHoursMinutes(selectedProjectStats.projectTotalMinutes)}
                    </span>
                    <span className="text-[10px] text-[#D4F63D] font-bold mt-0.5">
                      {selectedProjectStats.totalCount} tâche
                      {selectedProjectStats.totalCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[9px] text-[#8E929E]">
                      {period === "all" ? "total" : period === "month" ? "ce mois" : "cette sem."}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Categories breakdown list */}
            <div className="flex-1 w-full space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E929E] pb-1 border-b border-[#282A30]">
                <span>Sous-catégorie</span>
                <span>Temps & Tâches</span>
              </div>

              {selectedProjectStats.categoriesList.map((cat, idx) => {
                const percent =
                  effectiveDetailTotal > 0
                    ? Math.round(
                        ((selectedProjectStats.projectTotalMinutes > 0
                          ? cat.durationMinutes
                          : cat.count) /
                          effectiveDetailTotal) *
                          100
                      )
                    : 0;
                const isHovered = hoveredIndex === idx;

                return (
                  <div
                    key={cat.id}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={cn(
                      "flex items-center justify-between text-xs p-1.5 rounded-xl transition-all",
                      isHovered ? "bg-white/5" : ""
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-white truncate font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold text-[#D4F63D]">
                        {formatDurationHoursMinutes(cat.durationMinutes)}
                      </span>
                      <span className="text-[10px] text-[#8E929E]">({cat.count} t.)</span>
                      <span className="text-[10px] text-[#6B7280] w-7 text-right">{percent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ================= GLOBAL ALL-PROJECTS CAMEMBERT VIEW ================= */
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
                    ({globalProjectData[hoveredIndex].count} t.)
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base font-black text-white leading-none">
                    {formatDurationHoursMinutes(totalGlobalMinutes)}
                  </span>
                  <span className="text-[10px] text-[#D4F63D] font-bold mt-0.5">
                    {allProjectTasks.length} tâche{allProjectTasks.length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Project Legend List with duration & click-to-drilldown */}
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
                    <span className="text-[10px] text-[#8E929E]">({p.count} t.)</span>
                    <span className="text-[10px] text-[#6B7280] w-7 text-right">{percent}%</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6B7280] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
