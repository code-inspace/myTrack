"use client";

import React, { useState, useMemo } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectStatsViewProps {
  projects: Project[];
  tasks: Task[];
  completions?: TaskCompletion[];
  onBack: () => void;
  onEditTask?: (task: Task) => void;
  initialProjectId?: string | null;
}

// Helpers for SVG Pie/Donut Chart slices
function getCoordinatesForPercent(percent: number) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

function DonutChart({
  data,
  total,
  hoveredIndex,
  onHover,
  onClick,
  centerLabel = "Tâches",
  centerSubLabel,
}: {
  data: { label: string; value: number; color: string; id: string }[];
  total: number;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
  onClick: (id: string) => void;
  centerLabel?: string;
  centerSubLabel?: string;
}) {
  if (total === 0) {
    return (
      <div className="relative w-56 h-56 mx-auto flex items-center justify-center">
        <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90">
          <circle cx="0" cy="0" r="0.8" fill="transparent" stroke="#252830" strokeWidth="0.3" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <span className="text-xl font-extrabold text-white">0</span>
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
          if (slice.value === 0) return null;
          const percent = slice.value / total;
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
            <span className="text-2xl font-black text-white leading-none tracking-tight">
              {data[hoveredIndex].value}
            </span>
            <span className="text-xs font-bold text-[#D4F63D] mt-1">
              {Math.round((data[hoveredIndex].value / total) * 100)}%
            </span>
            <span className="text-[11px] text-[#8E929E] truncate max-w-[120px] mt-0.5">
              {data[hoveredIndex].label}
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl font-black text-white leading-none tracking-tight">
              {total}
            </span>
            <span className="text-xs text-[#8E929E] font-medium mt-1">{centerLabel}</span>
            {centerSubLabel && (
              <span className="text-[10px] text-[#6B7280] mt-0.5">{centerSubLabel}</span>
            )}
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

  // Chart data: Distribution by project
  const projectChartData = useMemo(() => {
    return projects.map((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id && !t.isArchived);
      return {
        id: p.id,
        label: p.name,
        value: pTasks.length,
        color: p.color || "#D4F63D",
      };
    });
  }, [projects, tasks]);

  // Specific project details if selected
  const singleProjectTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter((t) => t.projectId === selectedProjectId && !t.isArchived);
  }, [tasks, selectedProjectId]);

  // Project categories breakdown
  const projectCategoryChartData = useMemo(() => {
    if (!selectedProject) return [];
    const counts: Record<string, number> = {};

    for (const t of singleProjectTasks) {
      const cat = t.projectCategory || t.category || "Général";
      counts[cat] = (counts[cat] || 0) + 1;
    }

    const categories = Object.keys(counts);
    return categories.map((cat, idx) => ({
      id: cat,
      label: cat,
      value: counts[cat],
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));
  }, [selectedProject, singleProjectTasks]);

  // Project status breakdown (Kanban columns)
  const projectStatusBreakdown = useMemo(() => {
    if (!selectedProject) return [];
    const columns = getProjectColumns(selectedProject);
    return columns.map((col) => {
      const count = singleProjectTasks.filter((t) => t.projectStatus === col.id).length;
      return {
        id: col.id,
        label: col.label,
        isDone: col.isDone,
        count,
        percent: singleProjectTasks.length > 0 ? Math.round((count / singleProjectTasks.length) * 100) : 0,
      };
    });
  }, [selectedProject, singleProjectTasks]);

  // Completed tasks count in current project
  const projectCompletedCount = useMemo(() => {
    if (!selectedProject) return 0;
    const doneColumnIds = new Set(
      getProjectColumns(selectedProject)
        .filter((c) => c.isDone)
        .map((c) => c.id)
    );
    return singleProjectTasks.filter((t) => t.projectStatus && doneColumnIds.has(t.projectStatus)).length;
  }, [selectedProject, singleProjectTasks]);

  const completionRate = singleProjectTasks.length > 0
    ? Math.round((projectCompletedCount / singleProjectTasks.length) * 100)
    : 0;

  // Filtered task list for drill-down view
  const filteredSingleTasks = useMemo(() => {
    if (selectedCategoryFilter === "ALL") return singleProjectTasks;
    return singleProjectTasks.filter(
      (t) => (t.projectCategory || t.category || "Général") === selectedCategoryFilter
    );
  }, [singleProjectTasks, selectedCategoryFilter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full bg-[#0E0F12] text-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#202228] bg-[#111214] flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedProjectId) {
                setSelectedProjectId(null);
              } else {
                onBack();
              }
            }}
            className="p-2 rounded-xl bg-[#1C1D22] hover:bg-[#282A30] text-[#8E929E] hover:text-white transition-colors cursor-pointer"
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
                ? "Répartition par catégories et état d'avancement"
                : "Camembert de répartition des tâches par projets"}
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
          <div className="px-3 py-1.5 rounded-xl bg-[#D4F63D]/10 border border-[#D4F63D]/20 text-[#D4F63D] text-xs font-bold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>{projectTasks.length} tâches assignées</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {selectedProject ? (
          /* ================= DETAIL DRILL-DOWN VIEW FOR A PROJECT ================= */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top KPI Cards for this project */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#16171C] border border-[#282A30] flex flex-col">
                <span className="text-[11px] font-semibold text-[#8E929E] uppercase tracking-wider">
                  Total Tâches
                </span>
                <span className="text-2xl font-black text-white mt-1">
                  {singleProjectTasks.length}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#16171C] border border-[#282A30] flex flex-col">
                <span className="text-[11px] font-semibold text-[#8E929E] uppercase tracking-wider">
                  Complétées
                </span>
                <span className="text-2xl font-black text-[#D4F63D] mt-1">
                  {projectCompletedCount}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#16171C] border border-[#282A30] flex flex-col">
                <span className="text-[11px] font-semibold text-[#8E929E] uppercase tracking-wider">
                  Progression
                </span>
                <span className="text-2xl font-black text-[#60A5FA] mt-1">
                  {completionRate}%
                </span>
              </div>
            </div>

            {/* Category Chart & Kanban Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Category Breakdown Donut */}
              <div className="p-5 rounded-3xl bg-[#16171C] border border-[#282A30] space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#D4F63D]" />
                  <span>Répartition par Catégorie</span>
                </h3>

                <DonutChart
                  data={projectCategoryChartData}
                  total={singleProjectTasks.length}
                  hoveredIndex={hoveredCategoryIdx}
                  onHover={setHoveredCategoryIdx}
                  onClick={(catId) => {
                    setSelectedCategoryFilter(selectedCategoryFilter === catId ? "ALL" : catId);
                  }}
                  centerLabel="Tâches"
                  centerSubLabel="dans ce projet"
                />

                {/* Categories List / Legend */}
                <div className="space-y-1.5 pt-2 border-t border-[#202228]">
                  {projectCategoryChartData.map((cat, idx) => {
                    const isSelected = selectedCategoryFilter === cat.id;
                    const percent = singleProjectTasks.length > 0
                      ? Math.round((cat.value / singleProjectTasks.length) * 100)
                      : 0;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setSelectedCategoryFilter(isSelected ? "ALL" : cat.id)
                        }
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-xl transition-all text-xs cursor-pointer",
                          isSelected
                            ? "bg-[#252830] border border-[#383C48] text-white"
                            : "hover:bg-white/5 text-[#8E929E] hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-semibold truncate">{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-bold text-white">{cat.value}</span>
                          <span className="text-[11px] text-[#6B7280] w-8 text-right">
                            {percent}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Columns Breakdown & Progress */}
              <div className="p-5 rounded-3xl bg-[#16171C] border border-[#282A30] space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#60A5FA]" />
                  <span>Avancement par Colonne Kanban</span>
                </h3>

                <div className="space-y-3 pt-2">
                  {projectStatusBreakdown.map((col) => (
                    <div key={col.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          {col.isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#D4F63D]" />}
                          {col.label}
                        </span>
                        <span className="text-[#8E929E]">
                          {col.count} ({col.percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#202228] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${col.percent}%`,
                            backgroundColor: col.isDone ? "#D4F63D" : selectedProject.color || "#60A5FA",
                          }}
                        />
                      </div>
                    </div>
                  ))}
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
                    {filteredSingleTasks.length === 0 ? (
                      <p className="text-xs text-[#6B7280] py-3 text-center">
                        Aucune tâche pour ce filtre
                      </p>
                    ) : (
                      filteredSingleTasks.map((t) => (
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
                      ))
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
                    <span>Répartition globale par Projet</span>
                  </h2>
                  <p className="text-xs text-[#8E929E]">
                    Clique sur un projet ou une portion pour zoomer sur ses catégories
                  </p>
                </div>
              </div>

              <div className="py-4">
                <DonutChart
                  data={projectChartData}
                  total={projectTasks.length}
                  hoveredIndex={hoveredProjectIdx}
                  onHover={setHoveredProjectIdx}
                  onClick={(projectId) => setSelectedProjectId(projectId)}
                  centerLabel="Tâches projet"
                  centerSubLabel="sur tous les projets"
                />
              </div>
            </div>

            {/* Interactive Projects Cards List */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E929E] px-1">
                Détail des projets ({projects.length})
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((project, idx) => {
                  const pTasks = tasks.filter((t) => t.projectId === project.id && !t.isArchived);
                  const percent = projectTasks.length > 0
                    ? Math.round((pTasks.length / projectTasks.length) * 100)
                    : 0;

                  return (
                    <div
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
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
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate group-hover:text-[#D4F63D] transition-colors">
                            {project.name}
                          </div>
                          <div className="text-[11px] text-[#8E929E] mt-0.5">
                            {pTasks.length} tâche{pTasks.length !== 1 ? "s" : ""} &bull; {percent}% du total
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="text-xs font-extrabold px-2.5 py-1 rounded-lg"
                          style={{
                            backgroundColor: `${project.color}20`,
                            color: project.color,
                          }}
                        >
                          {pTasks.length}
                        </span>
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
