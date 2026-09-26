"use client";

import React, { useState, useMemo } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { getExternalEventDurationMinutes } from "@/features/calendar/lib/duration";
import { isExternalEventDone } from "@/features/calendar/lib/status";
import { Project, getProjectColumns } from "../types";
import {
  ArrowLeft,
  PieChart as PieChartIcon,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  TrendingUp,
  FolderKanban,
  Tag,
  BarChart3,
  Timer,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectStatsViewProps {
  projects: Project[];
  tasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  completions?: TaskCompletion[];
  onBack: () => void;
  onEditTask?: (task: Task) => void;
  initialProjectId?: string | null;
}

// Helpers for duration calculation
function getTaskCompletionDurationMinutes(c: TaskCompletion, task?: Task): number {
  if (c.actualStartTime && c.actualEndTime) {
    const [h1, m1] = c.actualStartTime.split(":").map(Number);
    const [h2, m2] = c.actualEndTime.split(":").map(Number);
    if (!isNaN(h1) && !isNaN(h2)) {
      let diff = h2 * 60 + m2 - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      if (diff > 0) return diff;
    }
  }
  if (c.scheduledStartTime && c.scheduledEndTime) {
    const [h1, m1] = c.scheduledStartTime.split(":").map(Number);
    const [h2, m2] = c.scheduledEndTime.split(":").map(Number);
    if (!isNaN(h1) && !isNaN(h2)) {
      let diff = h2 * 60 + m2 - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      if (diff > 0) return diff;
    }
  }
  if (task?.startTime && task?.endTime) {
    const [h1, m1] = task.startTime.split(":").map(Number);
    const [h2, m2] = task.endTime.split(":").map(Number);
    if (!isNaN(h1) && !isNaN(h2)) {
      let diff = h2 * 60 + m2 - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      if (diff > 0) return diff;
    }
  }
  if (typeof c.duration === "number" && c.duration > 0 && c.duration <= 24 * 60) {
    return c.duration;
  }
  if (task?.isActive && task?.startedAt) {
    const elapsed = Math.max(1, Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 60000));
    return Math.min(24 * 60, elapsed);
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

// Helpers for SVG Pie/Donut Chart slices
function getCoordinatesForPercent(percent: number) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

interface ChartSliceData {
  id: string;
  label: string;
  durationMinutes: number;
  taskCount: number;
  color: string;
}

function DonutChart({
  data,
  totalMinutes,
  totalTasks,
  hoveredIndex,
  onHover,
  onClick,
  centerLabel = "Temps passé",
}: {
  data: ChartSliceData[];
  totalMinutes: number;
  totalTasks: number;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
  onClick: (id: string) => void;
  centerLabel?: string;
}) {
  const effectiveTotal = totalMinutes > 0 ? totalMinutes : totalTasks;

  if (effectiveTotal === 0) {
    return (
      <div className="relative w-56 h-56 mx-auto flex items-center justify-center">
        <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90">
          <circle cx="0" cy="0" r="0.8" fill="transparent" stroke="#252830" strokeWidth="0.3" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <span className="text-xl font-extrabold text-white">0 min</span>
          <span className="text-xs text-[#8E929E]">Aucune tâche</span>
        </div>
      </div>
    );
  }

  let cumulativePercent = 0;

  return (
    <div className="relative w-60 h-60 md:w-64 md:h-64 mx-auto select-none">
      <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-full h-full -rotate-90 overflow-visible">
        {data.map((slice, index) => {
          const sliceValue = totalMinutes > 0 ? slice.durationMinutes : slice.taskCount;
          if (sliceValue === 0) return null;
          const percent = sliceValue / effectiveTotal;
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += percent;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const isLargeArc = percent > 0.5 ? 1 : 0;
          const isHovered = hoveredIndex === index;

          // If slice is 100%, render a full ring
          if (percent >= 0.999) {
            return (
              <circle
                key={slice.id}
                cx="0"
                cy="0"
                r="0.8"
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? "0.38" : "0.32"}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => onHover(index)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onClick(slice.id)}
                style={{
                  filter: isHovered ? `drop-shadow(0 0 10px ${slice.color})` : "none",
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
                "transition-all duration-300 cursor-pointer opacity-90 hover:opacity-100",
                isHovered && "scale-105"
              )}
              style={{
                transformOrigin: "0 0",
                filter: isHovered ? `drop-shadow(0 0 12px ${slice.color})` : "none",
              }}
              onMouseEnter={() => onHover(index)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClick(slice.id)}
            />
          );
        })}
      </svg>

      {/* Center Information */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
        {hoveredIndex !== null && data[hoveredIndex] ? (
          <>
            <span className="text-xl font-black text-white leading-none tracking-tight">
              {formatDurationHoursMinutes(data[hoveredIndex].durationMinutes)}
            </span>
            <span className="text-xs font-bold text-[#D4F63D] mt-1">
              {effectiveTotal > 0
                ? Math.round(
                    ((totalMinutes > 0
                      ? data[hoveredIndex].durationMinutes
                      : data[hoveredIndex].taskCount) /
                      effectiveTotal) *
                      100
                  )
                : 0}
              % du temps
            </span>
            <span className="text-[11px] text-[#8E929E] truncate max-w-[120px] mt-0.5">
              {data[hoveredIndex].label} ({data[hoveredIndex].taskCount} élém.
              {data[hoveredIndex].taskCount !== 1 ? "s" : ""})
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl font-black text-white leading-none tracking-tight">
              {formatDurationHoursMinutes(totalMinutes)}
            </span>
            <span className="text-xs text-[#8E929E] font-medium mt-1">{centerLabel}</span>
            <span className="text-[11px] text-[#D4F63D] font-bold mt-0.5">
              {totalTasks} élément{totalTasks !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
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

export const ProjectStatsView: React.FC<ProjectStatsViewProps> = ({
  projects,
  tasks,
  externalEvents = [],
  completions = [],
  onBack,
  onEditTask,
  initialProjectId,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  const [hoveredProjectIdx, setHoveredProjectIdx] = useState<number | null>(null);
  const [hoveredCategoryIdx, setHoveredCategoryIdx] = useState<number | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Overall tasks assigned to projects
  const projectTasks = useMemo(() => {
    return tasks.filter((t) => Boolean(t.projectId) && !t.isArchived);
  }, [tasks]);

  // Overall external events assigned to projects
  const projectEvents = useMemo(() => {
    return externalEvents.filter((e) => Boolean(e.projectId));
  }, [externalEvents]);

  // Global project chart data based on duration & tasks + events
  const { projectChartData, totalGlobalMinutes } = useMemo(() => {
    let globalMinutes = 0;
    const projectMap = projects.map((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id && !t.isArchived);
      const pTaskIds = new Set(pTasks.map((t) => t.id));

      let pMinutes = 0;
      const pCompletions = completions.filter((c) => pTaskIds.has(c.taskId) && c.completed);

      if (pCompletions.length > 0) {
        for (const c of pCompletions) {
          const t = pTasks.find((item) => item.id === c.taskId);
          pMinutes += getTaskCompletionDurationMinutes(c, t);
        }
      } else {
        for (const t of pTasks) {
          pMinutes += getTaskScheduledDurationMinutes(t);
        }
      }

      const pEvents = externalEvents.filter((e) => e.projectId === p.id);
      for (const e of pEvents) {
        pMinutes += getExternalEventDurationMinutes(e);
      }

      globalMinutes += pMinutes;

      return {
        id: p.id,
        label: p.name,
        durationMinutes: pMinutes,
        taskCount: pTasks.length + pEvents.length,
        color: p.color || "#D4F63D",
      };
    });

    return { projectChartData: projectMap, totalGlobalMinutes: globalMinutes };
  }, [projects, tasks, externalEvents, completions]);

  // Specific project details if selected
  const singleProjectTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter((t) => t.projectId === selectedProjectId && !t.isArchived);
  }, [tasks, selectedProjectId]);

  const singleProjectEvents = useMemo(() => {
    if (!selectedProjectId) return [];
    return externalEvents.filter((e) => e.projectId === selectedProjectId);
  }, [externalEvents, selectedProjectId]);

  // Project categories breakdown based on duration & tasks + events
  const { projectCategoryChartData, totalSingleProjectMinutes } = useMemo(() => {
    if (!selectedProject) return { projectCategoryChartData: [], totalSingleProjectMinutes: 0 };
    const catMap: Record<string, { durationMinutes: number; taskCount: number }> = {};
    const singleTaskIds = new Set(singleProjectTasks.map((t) => t.id));
    const projectCompletions = completions.filter((c) => singleTaskIds.has(c.taskId) && c.completed);

    let totalProjMinutes = 0;

    for (const t of singleProjectTasks) {
      const cat = t.projectCategory || t.category || "Général";
      if (!catMap[cat]) {
        catMap[cat] = { durationMinutes: 0, taskCount: 0 };
      }
      catMap[cat].taskCount++;

      const tComps = projectCompletions.filter((c) => c.taskId === t.id);
      let tMins = 0;
      if (tComps.length > 0) {
        for (const c of tComps) {
          tMins += getTaskCompletionDurationMinutes(c, t);
        }
      } else {
        tMins = getTaskScheduledDurationMinutes(t);
      }

      catMap[cat].durationMinutes += tMins;
      totalProjMinutes += tMins;
    }

    for (const e of singleProjectEvents) {
      const cat = e.projectCategory || "Général";
      if (!catMap[cat]) {
        catMap[cat] = { durationMinutes: 0, taskCount: 0 };
      }
      catMap[cat].taskCount++;
      const eMins = getExternalEventDurationMinutes(e);
      catMap[cat].durationMinutes += eMins;
      totalProjMinutes += eMins;
    }

    const categories = Object.keys(catMap);
    const chartData = categories.map((cat, idx) => ({
      id: cat,
      label: cat,
      durationMinutes: catMap[cat].durationMinutes,
      taskCount: catMap[cat].taskCount,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));

    return { projectCategoryChartData: chartData, totalSingleProjectMinutes: totalProjMinutes };
  }, [selectedProject, singleProjectTasks, singleProjectEvents, completions]);

  // Project status breakdown (Kanban columns)
  const projectStatusBreakdown = useMemo(() => {
    if (!selectedProject) return [];
    const columns = getProjectColumns(selectedProject);
    const totalCount = singleProjectTasks.length + singleProjectEvents.length;
    return columns.map((col) => {
      const count = singleProjectTasks.filter((t) => t.projectStatus === col.id).length;
      return {
        id: col.id,
        label: col.label,
        isDone: col.isDone,
        count,
        percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      };
    });
  }, [selectedProject, singleProjectTasks, singleProjectEvents]);

  // Completed elements count in current project
  const projectCompletedCount = useMemo(() => {
    if (!selectedProject) return 0;
    const doneColumnIds = new Set(
      getProjectColumns(selectedProject)
        .filter((c) => c.isDone)
        .map((c) => c.id)
    );
    const completedTasks = singleProjectTasks.filter(
      (t) => t.projectStatus && doneColumnIds.has(t.projectStatus)
    ).length;
    const completedEvents = singleProjectEvents.filter((e) => isExternalEventDone(e)).length;
    return completedTasks + completedEvents;
  }, [selectedProject, singleProjectTasks, singleProjectEvents]);

  const totalSingleElementsCount = singleProjectTasks.length + singleProjectEvents.length;

  const completionRate =
    totalSingleElementsCount > 0
      ? Math.round((projectCompletedCount / totalSingleElementsCount) * 100)
      : 0;

  // Filtered task list for drill-down view
  const filteredSingleTasks = useMemo(() => {
    if (selectedCategoryFilter === "ALL") return singleProjectTasks;
    return singleProjectTasks.filter(
      (t) => (t.projectCategory || t.category || "Général") === selectedCategoryFilter
    );
  }, [singleProjectTasks, selectedCategoryFilter]);

  const filteredSingleEvents = useMemo(() => {
    if (selectedCategoryFilter === "ALL") return singleProjectEvents;
    return singleProjectEvents.filter(
      (e) => (e.projectCategory || "Général") === selectedCategoryFilter
    );
  }, [singleProjectEvents, selectedCategoryFilter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full bg-[#0E0F12] text-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#202228] bg-[#111214] flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedProject) {
                setSelectedProjectId(null);
                setHoveredProjectIdx(null);
              } else {
                onBack();
              }
            }}
            className="p-2 rounded-xl bg-[#1C1D22] hover:bg-[#282A30] text-[#8E929E] hover:text-white transition-colors cursor-pointer"
            title="Retour"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#D4F63D]" />
              <span>
                {selectedProject
                  ? `Statistiques : ${selectedProject.name}`
                  : "Statistiques des projets"}
              </span>
            </h1>
            <p className="text-xs text-[#8E929E]">
              {selectedProject
                ? "Répartition du temps passé et avancement par sous-catégories"
                : "Camembert du temps passé et totaux par projets"}
            </p>
          </div>
        </div>

        {selectedProject ? (
          <button
            type="button"
            onClick={() => setSelectedProjectId(null)}
            className="px-3 py-1.5 rounded-xl bg-[#202228] hover:bg-[#2A2C34] text-xs font-semibold text-[#D4F63D] transition-colors cursor-pointer"
          >
            Tous les projets
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-[#D4F63D]/10 border border-[#D4F63D]/20 text-[#D4F63D] text-xs font-bold flex items-center gap-2">
            <Timer className="w-3.5 h-3.5" />
            <span>{formatDurationHoursMinutes(totalGlobalMinutes)}</span>
            <span className="opacity-75">({projectTasks.length} tâches)</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-44 md:p-6 md:pb-12 space-y-6 max-w-5xl mx-auto w-full overscroll-y-contain">
        {selectedProject ? (
          /* ================= DETAIL DRILL-DOWN VIEW FOR A PROJECT ================= */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top KPI Cards for this project */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#16171C] border border-[#282A30] flex flex-col">
                <span className="text-[11px] font-semibold text-[#8E929E] uppercase tracking-wider">
                  Temps passé
                </span>
                <span className="text-2xl font-black text-[#D4F63D] mt-1">
                  {formatDurationHoursMinutes(totalSingleProjectMinutes)}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#16171C] border border-[#282A30] flex flex-col">
                <span className="text-[11px] font-semibold text-[#8E929E] uppercase tracking-wider">
                  Tâches
                </span>
                <span className="text-2xl font-black text-white mt-1">
                  {singleProjectTasks.length}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#16171C] border border-[#282A30] flex flex-col">
                <span className="text-[11px] font-semibold text-[#8E929E] uppercase tracking-wider">
                  Avancement
                </span>
                <span className="text-2xl font-black text-[#60A5FA] mt-1">
                  {completionRate}%
                </span>
              </div>
            </div>

            {/* Project Categories Breakdown & Donut Chart */}
            <div className="grid gap-6 md:grid-cols-2 items-start">
              {/* Category Donut Chart */}
              <div className="p-6 rounded-3xl bg-[#16171C] border border-[#282A30] flex flex-col items-center">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 self-start">
                  <Tag className="w-4 h-4 text-[#D4F63D]" />
                  <span>Temps passé par Sous-Catégorie</span>
                </h3>
                <DonutChart
                  data={projectCategoryChartData}
                  totalMinutes={totalSingleProjectMinutes}
                  totalTasks={singleProjectTasks.length}
                  hoveredIndex={hoveredCategoryIdx}
                  onHover={setHoveredCategoryIdx}
                  onClick={(catId) => setSelectedCategoryFilter(catId)}
                  centerLabel="Temps projet"
                />
              </div>

              {/* Status and Categories List */}
              <div className="p-6 rounded-3xl bg-[#16171C] border border-[#282A30] space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#60A5FA]" />
                    <span>Statut Kanban</span>
                  </h3>
                  <div className="space-y-2">
                    {projectStatusBreakdown.map((col) => (
                      <div key={col.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#8E929E] flex items-center gap-1.5">
                            {col.isDone && <CheckCircle2 className="w-3 h-3 text-[#D4F63D]" />}
                            <span>{col.label}</span>
                          </span>
                          <span className="font-bold text-white">
                            {col.count} ({col.percent}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[#202228] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              col.isDone ? "bg-[#D4F63D]" : "bg-[#60A5FA]"
                            )}
                            style={{ width: `${col.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subcategories Breakdown Table */}
                <div className="pt-3 border-t border-[#202228] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8E929E]">
                    <span>Sous-catégorie</span>
                    <span>Temps & Tâches</span>
                  </div>
                  {projectCategoryChartData.map((cat, idx) => {
                    const percent =
                      totalSingleProjectMinutes > 0
                        ? Math.round((cat.durationMinutes / totalSingleProjectMinutes) * 100)
                        : Math.round((cat.taskCount / singleProjectTasks.length) * 100);

                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setSelectedCategoryFilter(cat.id)}
                        onMouseEnter={() => setHoveredCategoryIdx(idx)}
                        onMouseLeave={() => setHoveredCategoryIdx(null)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer text-left",
                          selectedCategoryFilter === cat.id
                            ? "bg-[#252830] ring-1 ring-[#D4F63D]/40"
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-white truncate font-medium">{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-right">
                          <span className="font-bold text-[#D4F63D]">
                            {formatDurationHoursMinutes(cat.durationMinutes)}
                          </span>
                          <span className="text-[11px] text-[#8E929E]">
                            ({cat.taskCount} t.)
                          </span>
                          <span className="text-[10px] text-[#6B7280] w-8">{percent}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Filterable Tasks List within this project */}
                <div className="pt-4 border-t border-[#202228] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8E929E]">
                      Tâches {selectedCategoryFilter !== "ALL" ? `(${selectedCategoryFilter})` : ""}
                    </span>
                    {selectedCategoryFilter !== "ALL" && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryFilter("ALL")}
                        className="text-[10px] text-[#D4F63D] hover:underline cursor-pointer"
                      >
                        Réinitialiser le filtre
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {filteredSingleTasks.length === 0 && filteredSingleEvents.length === 0 ? (
                      <p className="text-xs text-[#6B7280] py-3 text-center">
                        Aucun élément pour ce filtre
                      </p>
                    ) : (
                      <>
                        {filteredSingleEvents.map((e) => (
                          <div
                            key={e.id}
                            className="p-2.5 rounded-xl bg-[#202228] hover:bg-[#252830] transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: e.calendarColor || "#3B82F6" }}
                              />
                              <span className="text-xs font-medium text-white truncate">
                                {e.title}
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#3B82F6]/10 text-[#60A5FA] flex-shrink-0">
                              {e.calendarName || "Agenda"}
                            </span>
                          </div>
                        ))}
                        {filteredSingleTasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => onEditTask && onEditTask(t)}
                            className="p-2.5 rounded-xl bg-[#202228] hover:bg-[#252830] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-xs font-medium text-white truncate">
                              {t.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-[#8E929E] flex-shrink-0">
                              {t.projectCategory || t.category || "Général"}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= GLOBAL ALL-PROJECTS CAMEMBERT VIEW ================= */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Donut Chart & Overview */}
            <div className="p-6 rounded-3xl bg-[#16171C] border border-[#282A30] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-[#D4F63D]" />
                    <span>Répartition globale du temps par Projet</span>
                  </h2>
                  <p className="text-xs text-[#8E929E]">
                    Camembert calculé sur le temps passé avec totaux d&apos;heures et de tâches
                  </p>
                </div>
              </div>

              <div className="py-4">
                <DonutChart
                  data={projectChartData}
                  totalMinutes={totalGlobalMinutes}
                  totalTasks={projectTasks.length}
                  hoveredIndex={hoveredProjectIdx}
                  onHover={setHoveredProjectIdx}
                  onClick={(projectId) => setSelectedProjectId(projectId)}
                  centerLabel="Temps total"
                />
              </div>
            </div>

            {/* Interactive Projects Cards List */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E929E] px-1">
                Détail des projets ({projects.length})
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {projectChartData.map((projectItem, idx) => {
                  const percent =
                    totalGlobalMinutes > 0
                      ? Math.round((projectItem.durationMinutes / totalGlobalMinutes) * 100)
                      : Math.round((projectItem.taskCount / projectTasks.length) * 100);

                  return (
                    <div
                      key={projectItem.id}
                      onClick={() => setSelectedProjectId(projectItem.id)}
                      onMouseEnter={() => setHoveredProjectIdx(idx)}
                      onMouseLeave={() => setHoveredProjectIdx(null)}
                      className={cn(
                        "p-4 rounded-2xl bg-[#16171C] hover:bg-[#202228] border transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-sm",
                        hoveredProjectIdx === idx
                          ? "border-[#D4F63D]/60 scale-[1.02]"
                          : "border-[#282A30] hover:border-[#383C48]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: projectItem.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate group-hover:text-[#D4F63D] transition-colors">
                            {projectItem.label}
                          </div>
                          <div className="text-[11px] text-[#8E929E] mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[#D4F63D]">
                              {formatDurationHoursMinutes(projectItem.durationMinutes)}
                            </span>
                            <span>&bull;</span>
                            <span>
                              {projectItem.taskCount} tâche{projectItem.taskCount !== 1 ? "s" : ""}
                            </span>
                            <span>&bull;</span>
                            <span>{percent}% du temps</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ChevronRight className="w-4 h-4 text-[#6B7280] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
