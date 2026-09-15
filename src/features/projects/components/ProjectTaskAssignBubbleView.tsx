"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Task } from "@/features/tasks/types";
import { Project } from "../types";
import { useTaskMutations } from "@/features/tasks/hooks";
import { useProjectMutations } from "@/features/projects/hooks";
import { getTodayDateString } from "@/lib/dates";
import {
  ArrowLeft,
  Search,
  FolderKanban,
  Sparkles,
  GripVertical,
  CheckCircle2,
  Clock,
  Calendar,
  Plus,
  Layers,
  Tag,
  ChevronLeft,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface ProjectTaskAssignBubbleViewProps {
  projects: Project[];
  tasks: Task[];
  onBack: () => void;
  onEditTask: (task: Task) => void;
}

// Unequal compact bubble dimension variations (capped to fit within 1/3 screen)
const BUBBLE_SIZES = [
  { sizeClass: "w-20 h-20 md:w-28 md:h-28", minDim: 80, labelClass: "text-[11px]", countClass: "text-[9px]" },
  { sizeClass: "w-16 h-16 md:w-22 md:h-22", minDim: 64, labelClass: "text-[10px]", countClass: "text-[8px]" },
  { sizeClass: "w-22 h-22 md:w-32 md:h-32", minDim: 88, labelClass: "text-xs font-bold", countClass: "text-[9px]" },
  { sizeClass: "w-18 h-18 md:w-24 md:h-24", minDim: 72, labelClass: "text-[10px]", countClass: "text-[8px]" },
  { sizeClass: "w-21 h-21 md:w-28 md:h-28", minDim: 84, labelClass: "text-[11px] font-semibold", countClass: "text-[9px]" },
  { sizeClass: "w-17 h-17 md:w-22 md:h-22", minDim: 68, labelClass: "text-[10px]", countClass: "text-[8px]" },
];

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

// Project Droppable Bubble with conditional 1-second hover countdown circle
function ProjectDroppableBubble({
  project,
  index,
  taskCount,
  isOverTarget,
  hoverProgress, // 0 to 1
  isDraggingActive,
  hasCategories,
  onClick,
}: {
  project: Project;
  index: number;
  taskCount: number;
  isOverTarget: boolean;
  hoverProgress: number;
  isDraggingActive: boolean;
  hasCategories: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `project-${project.id}`,
    data: { project, type: "project" },
  });

  const activeIsOver = isOver || isOverTarget;
  const config = BUBBLE_SIZES[index % BUBBLE_SIZES.length];

  // SVG dimensions for progress circle
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - hoverProgress * circumference;

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "relative rounded-full flex flex-col items-center justify-center text-center p-1.5 transition-all duration-300 select-none cursor-pointer flex-shrink-0 group",
        config.sizeClass,
        activeIsOver
          ? "scale-110 shadow-2xl z-20"
          : "hover:scale-105 shadow-md hover:shadow-lg"
      )}
      style={{
        backgroundColor: activeIsOver ? `${project.color}33` : "#16181D",
        borderColor: activeIsOver ? project.color : `${project.color}55`,
        borderWidth: activeIsOver ? "2.5px" : "1.5px",
        boxShadow: activeIsOver
          ? `0 0 25px ${project.color}66, 0 0 8px ${project.color}`
          : `0 3px 12px rgba(0,0,0,0.4)`,
      }}
    >
      {/* 1-Second Circular Hover Countdown Ring (ONLY IF PROJECT HAS CATEGORIES) */}
      {hasCategories && isDraggingActive && activeIsOver && (
        <svg
          className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90 pointer-events-none z-30"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={project.color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-75"
            style={{
              filter: `drop-shadow(0 0 5px ${project.color})`,
            }}
          />
        </svg>
      )}

      {/* Background glow subtle gradient */}
      <div
        className="absolute inset-0 rounded-full opacity-20 pointer-events-none group-hover:opacity-35 transition-opacity"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${project.color}, transparent 70%)`,
        }}
      />

      {/* Floating indicator icon */}
      <div
        className="w-2 h-2 rounded-full mb-0.5 shadow-sm flex-shrink-0"
        style={{ backgroundColor: project.color }}
      />

      {/* Project name */}
      <span
        className={cn(
          "text-white font-bold leading-tight line-clamp-2 px-1 text-center drop-shadow-sm",
          config.labelClass
        )}
      >
        {project.name}
      </span>

      {/* Task count or Drop prompt */}
      {activeIsOver ? (
        <span
          className="mt-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold text-black flex items-center gap-1 animate-pulse"
          style={{ backgroundColor: project.color }}
        >
          {hasCategories && hoverProgress > 0 && hoverProgress < 1 ? (
            <span>1s...</span>
          ) : (
            <span>Déposer</span>
          )}
        </span>
      ) : (
        <span className={cn("text-[#8E929E] mt-0.5", config.countClass)}>
          {taskCount} tâche{taskCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

// Category Droppable Bubble inside a project
function CategoryDroppableBubble({
  categoryName,
  projectId,
  color,
  taskCount,
  index,
  isOverTarget,
}: {
  categoryName: string;
  projectId: string;
  color: string;
  taskCount: number;
  index: number;
  isOverTarget: boolean;
}) {
  const droppableId = `cat__${projectId}__${encodeURIComponent(categoryName)}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { categoryName, projectId, type: "category" },
  });

  const activeIsOver = isOver || isOverTarget;
  const config = BUBBLE_SIZES[(index + 1) % BUBBLE_SIZES.length];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-full flex flex-col items-center justify-center text-center p-1.5 transition-all duration-300 select-none cursor-pointer flex-shrink-0 group",
        config.sizeClass,
        activeIsOver
          ? "scale-110 shadow-2xl z-20"
          : "hover:scale-105 shadow-md hover:shadow-lg"
      )}
      style={{
        backgroundColor: activeIsOver ? `${color}44` : "#16181D",
        borderColor: activeIsOver ? color : `${color}66`,
        borderWidth: activeIsOver ? "2.5px" : "1.5px",
        boxShadow: activeIsOver
          ? `0 0 25px ${color}88, 0 0 8px ${color}`
          : `0 3px 12px rgba(0,0,0,0.4)`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full opacity-20 pointer-events-none group-hover:opacity-35 transition-opacity"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color}, transparent 70%)`,
        }}
      />

      <Tag className="w-2.5 h-2.5 mb-0.5 flex-shrink-0" style={{ color }} />

      <span
        className={cn(
          "text-white font-bold leading-tight line-clamp-2 px-1 text-center drop-shadow-sm",
          config.labelClass
        )}
      >
        {categoryName}
      </span>

      {activeIsOver ? (
        <span
          className="mt-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold text-black flex items-center gap-1 animate-bounce"
          style={{ backgroundColor: color }}
        >
          <Plus className="w-2.5 h-2.5" />
          Déposer
        </span>
      ) : (
        <span className={cn("text-[#8E929E] mt-0.5", config.countClass)}>
          {taskCount} tâche{taskCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

// Draggable Unassigned Task Card
function DraggableTaskCard({
  task,
  projects,
  onAssignToProject,
  onEditTask,
}: {
  task: Task;
  projects: Project[];
  onAssignToProject: (taskId: string, projectId: string, category?: string | null) => void;
  onEditTask: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { task },
  });

  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-2xl bg-[#16171C] border border-[#282A30] hover:border-[#383C48] p-3.5 transition-all flex items-center justify-between gap-3 group select-none",
        isDragging && "opacity-40 border-dashed border-[#D4F63D]"
      )}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="p-1.5 -ml-1 text-[#6B7280] hover:text-[#D4F63D] cursor-grab active:cursor-grabbing rounded-lg hover:bg-white/5 flex-shrink-0 touch-none"
        title="Glisser vers un projet"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Task details */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onEditTask(task)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate max-w-[220px]">
            {task.title}
          </span>
          {task.category && (
            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[#A0A5B5] text-[10px] font-medium border border-white/10">
              {task.category}
            </span>
          )}
          {task.priority && task.priority !== "NORMAL" && (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
              {task.priority === "VERY_URGENT" ? "Urgent +" : "Urgent"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#8E929E]">
          {task.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#D4F63D]" />
              {task.deadline}
            </span>
          )}
          {task.startTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#8E929E]" />
              {task.startTime}
              {task.endTime ? ` - ${task.endTime}` : ""}
            </span>
          )}
          {task.recurrence && task.recurrence !== "ONCE" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4F63D]/10 text-[#D4F63D]">
              {task.recurrence}
            </span>
          )}
        </div>
      </div>

      {/* Quick assign button / dropdown */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowQuickMenu(!showQuickMenu)}
          className="px-2.5 py-1.5 rounded-xl bg-[#202228] hover:bg-[#2A2C34] text-xs font-semibold text-[#D4F63D] border border-transparent hover:border-[#D4F63D]/30 transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>Affecter</span>
        </button>

        {showQuickMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowQuickMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[#1C1D22] border border-[#383C48] shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#8E929E] uppercase tracking-wider border-b border-[#282A30]">
                Choisir un projet
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onAssignToProject(task.id, p.id, null);
                      setShowQuickMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate flex-1">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const ProjectTaskAssignBubbleView: React.FC<ProjectTaskAssignBubbleViewProps> = ({
  projects,
  tasks,
  onBack,
  onEditTask,
}) => {
  const todayStr = getTodayDateString();
  const { updateTask } = useTaskMutations();
  const { updateProject } = useProjectMutations();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overTargetId, setOverTargetId] = useState<string | null>(null);
  const [zoomedProject, setZoomedProject] = useState<Project | null>(null);

  // 1-second countdown hover tracking state
  const [hoverProgress, setHoverProgress] = useState(0);
  const hoverStartTimeRef = useRef<number | null>(null);
  const hoverProjectIdRef = useRef<string | null>(null);
  const hoverIntervalRef = useRef<any>(null);

  const [filterType, setFilterType] = useState<"ALL" | "CURRENT" | "UPCOMING" | "PAST">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [newCatInput, setNewCatInput] = useState("");
  const [showAddCat, setShowAddCat] = useState(false);
  const [assignedToast, setAssignedToast] = useState<{
    taskTitle: string;
    projectName: string;
    categoryName?: string | null;
  } | null>(null);

  // Helper to check if project has categories defined
  const projectHasCategories = (p?: Project | null): boolean => {
    return Boolean(p && Array.isArray(p.categories) && p.categories.length > 0);
  };

  // All tasks without a project and not archived
  const unassignedTasks = useMemo(() => {
    return tasks.filter((t) => !t.projectId && !t.isArchived);
  }, [tasks]);

  // Tasks counts by project
  const taskCountByProjectId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) counts[p.id] = 0;
    for (const t of tasks) {
      if (t.projectId && !t.isArchived && counts[t.projectId] !== undefined) {
        counts[t.projectId]++;
      }
    }
    return counts;
  }, [projects, tasks]);

  // Categories for the currently zoomed project
  const currentProjectCategories = useMemo(() => {
    if (!zoomedProject) return [];
    const catList = Array.isArray(zoomedProject.categories) ? [...zoomedProject.categories] : [];
    // Ensure "Général" is present
    if (!catList.includes("Général")) {
      catList.unshift("Général");
    }
    return catList;
  }, [zoomedProject]);

  // Task count by category in zoomed project
  const taskCountByCategory = useMemo(() => {
    if (!zoomedProject) return {};
    const counts: Record<string, number> = {};
    for (const c of currentProjectCategories) counts[c] = 0;
    for (const t of tasks) {
      if (t.projectId === zoomedProject.id && !t.isArchived) {
        const cat = t.projectCategory || "Général";
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [zoomedProject, currentProjectCategories, tasks]);

  // Filtered unassigned tasks
  const filteredTasks = useMemo(() => {
    let list = unassignedTasks;

    if (filterType === "CURRENT") {
      list = list.filter(
        (t) =>
          t.isActive ||
          t.recurrence === "DAILY" ||
          t.deadline === todayStr ||
          (!t.deadline && t.recurrence !== "ONCE")
      );
    } else if (filterType === "UPCOMING") {
      list = list.filter((t) => t.deadline && t.deadline > todayStr);
    } else if (filterType === "PAST") {
      list = list.filter((t) => t.deadline && t.deadline < todayStr);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [unassignedTasks, filterType, searchQuery, todayStr]);

  // Clear timer helper
  const clearHoverTimer = () => {
    if (hoverIntervalRef.current) {
      clearInterval(hoverIntervalRef.current);
      hoverIntervalRef.current = null;
    }
    hoverStartTimeRef.current = null;
    hoverProjectIdRef.current = null;
    setHoverProgress(0);
  };

  useEffect(() => {
    return () => {
      clearHoverTimer();
    };
  }, []);

  const handleAssignToProject = (
    taskId: string,
    projectId: string,
    categoryName?: string | null
  ) => {
    const project = projects.find((p) => p.id === projectId);
    const task = tasks.find((t) => t.id === taskId);
    if (!project || !task) return;

    const firstColumnId = project.columns && project.columns.length > 0 ? project.columns[0].id : "TODO";
    const cleanCategory = !categoryName || categoryName === "Général" ? null : categoryName.trim();

    updateTask.mutate({
      taskId,
      values: {
        projectId: project.id,
        projectStatus: firstColumnId,
        projectCategory: cleanCategory,
      },
    });

    setAssignedToast({
      taskTitle: task.title,
      projectName: project.name,
      categoryName: cleanCategory,
    });
    setTimeout(() => {
      setAssignedToast(null);
    }, 3500);
  };

  const handleAddCategory = () => {
    if (!zoomedProject || !newCatInput.trim()) return;
    const cat = newCatInput.trim();
    const existing = zoomedProject.categories || [];
    if (!existing.includes(cat)) {
      const updated = [...existing, cat];
      updateProject.mutate({
        projectId: zoomedProject.id,
        updates: { categories: updated },
      });
      setZoomedProject({ ...zoomedProject, categories: updated });
    }
    setNewCatInput("");
    setShowAddCat(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task;
    if (task) {
      setActiveTask(task);
    }
    clearHoverTimer();
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id ? String(event.over.id) : null;
    setOverTargetId(overId);

    // If we are on the main project bubble list and hovering over a project
    if (!zoomedProject && overId && overId.startsWith("project-")) {
      const pId = overId.replace("project-", "");
      const targetProj = projects.find((p) => p.id === pId);

      // ONLY trigger 1-second countdown if this project actually has categories!
      if (projectHasCategories(targetProj)) {
        if (hoverProjectIdRef.current !== pId) {
          clearHoverTimer();
          hoverProjectIdRef.current = pId;
          hoverStartTimeRef.current = Date.now();

          hoverIntervalRef.current = setInterval(() => {
            if (!hoverStartTimeRef.current) return;
            const elapsed = Date.now() - hoverStartTimeRef.current;
            const progress = Math.min(elapsed / 1000, 1);
            setHoverProgress(progress);

            if (progress >= 1) {
              // 1 second elapsed! Zoom into project categories
              if (targetProj) {
                setZoomedProject(targetProj);
              }
              clearHoverTimer();
            }
          }, 30);
        }
      } else {
        clearHoverTimer();
      }
    } else {
      if (!zoomedProject) {
        clearHoverTimer();
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    clearHoverTimer();

    setActiveTask(null);
    setOverTargetId(null);

    if (!over) {
      // Returned / dropped outside -> restore project bubbles view
      setZoomedProject(null);
      return;
    }

    const overId = String(over.id);
    const taskId = String(active.id).replace("task-", "");
    const overData = over.data?.current;

    if (overId.startsWith("cat__") || overData?.type === "category") {
      // Dropped on a category bubble
      const catName = overData?.categoryName || decodeURIComponent(overId.split("__")[2] || "");
      const projId = overData?.projectId || (zoomedProject ? zoomedProject.id : overId.split("__")[1]);

      if (projId) {
        handleAssignToProject(taskId, projId, catName);
      }
      // Re-display the main project bubbles immediately
      setZoomedProject(null);
    } else if (overId.startsWith("project-") || overData?.type === "project") {
      // Dropped directly on a project bubble (without waiting or on a project with no categories)
      const targetProjectId = overData?.project?.id || overId.replace("project-", "");
      handleAssignToProject(taskId, targetProjectId, null);
      // Re-display the main project bubbles immediately
      setZoomedProject(null);
    } else {
      setZoomedProject(null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex flex-col min-h-0 w-full bg-[#0E0F12] text-white">
        {/* Top Header - Compact & Sleek */}
        <div className="px-3 py-2 md:px-4 md:py-2.5 border-b border-[#202228] bg-[#111214] flex items-center justify-between flex-shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (zoomedProject) {
                  setZoomedProject(null);
                } else {
                  onBack();
                }
              }}
              className="p-1.5 rounded-lg bg-[#1C1D22] hover:bg-[#282A30] text-[#8E929E] hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="Retour"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-[#D4F63D] flex-shrink-0" />
                <span className="truncate">
                  {zoomedProject
                    ? `Affecter à ${zoomedProject.name}`
                    : "Affecter les tâches à un projet"}
                </span>
              </h1>
              <p className="text-[10px] text-[#8E929E] truncate">
                {zoomedProject
                  ? "Dépose sur une catégorie pour l'affecter"
                  : "Survole 1s pour les catégories ou dépose directement"}
              </p>
            </div>
          </div>

          {zoomedProject && (
            <button
              type="button"
              onClick={() => setZoomedProject(null)}
              className="px-2.5 py-1 rounded-lg bg-[#202228] hover:bg-[#2A2C34] text-[11px] font-semibold text-[#D4F63D] flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0 ml-2"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Projets</span>
            </button>
          )}
        </div>

        {/* Assigned success toast banner */}
        {assignedToast && (
          <div className="bg-[#D4F63D] text-black px-3 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-lg animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="truncate">
              &ldquo;{assignedToast.taskTitle}&rdquo; &rarr; &ldquo;{assignedToast.projectName}&rdquo;
              {assignedToast.categoryName ? ` (${assignedToast.categoryName})` : ""} !
            </span>
          </div>
        )}

        {/* Main Content Area: Floating Bubbles (Top / Left max 1/3 screen) + Tasks List (Bottom / Right) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Bubbles Orbit Area - Capped to 1/3 screen height max on mobile */}
          <div className="p-2.5 md:p-5 border-b md:border-b-0 md:border-r border-[#202228] bg-[#121318] flex flex-col max-h-[30vh] md:max-h-none md:w-5/12 lg:w-4/12 flex-shrink-0 overflow-y-auto overscroll-contain">
            {zoomedProject ? (
              /* CATEGORIES OF ZOOMED PROJECT */
              <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: zoomedProject.color }}
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate max-w-[160px]">
                      {zoomedProject.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCat(!showAddCat)}
                    className="text-[10px] text-[#D4F63D] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Catégorie</span>
                  </button>
                </div>

                {showAddCat && (
                  <div className="p-2 rounded-xl bg-[#1C1D22] border border-[#383C48] flex items-center gap-2 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Nom de catégorie..."
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                      className="flex-1 px-2.5 py-1 rounded-lg bg-[#252830] text-[11px] text-white outline-none border border-transparent focus:border-[#D4F63D]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-2.5 py-1 rounded-lg bg-[#D4F63D] text-black font-bold text-[11px] cursor-pointer"
                    >
                      Ajouter
                    </button>
                  </div>
                )}

                {/* Category Bubbles cluster */}
                <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-1 min-h-[90px] md:min-h-[260px]">
                  {currentProjectCategories.map((catName, idx) => {
                    const droppableId = `cat__${zoomedProject.id}__${encodeURIComponent(catName)}`;
                    return (
                      <CategoryDroppableBubble
                        key={catName}
                        categoryName={catName}
                        projectId={zoomedProject.id}
                        color={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                        taskCount={taskCountByCategory[catName] || 0}
                        index={idx}
                        isOverTarget={overTargetId === droppableId}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ALL PROJECTS BUBBLES CLUSTER */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E929E] flex items-center gap-1">
                    <FolderKanban className="w-3 h-3 text-[#D4F63D]" />
                    Projets ({projects.length})
                  </span>
                  <span className="text-[9px] text-[#6B7280]">
                    Survol 1s = Catégories
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-1 min-h-[90px] md:min-h-[260px]">
                  {projects.map((project, idx) => {
                    const hasCats = projectHasCategories(project);
                    return (
                      <ProjectDroppableBubble
                        key={project.id}
                        project={project}
                        index={idx}
                        taskCount={taskCountByProjectId[project.id] || 0}
                        isOverTarget={overTargetId === `project-${project.id}`}
                        hoverProgress={hoverProjectIdRef.current === project.id ? hoverProgress : 0}
                        isDraggingActive={Boolean(activeTask)}
                        hasCategories={hasCats}
                        onClick={() => {
                          if (hasCats) {
                            setZoomedProject(project);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Unassigned Tasks List Section */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0E0F12] p-3 md:p-5 overflow-hidden">
            {/* Filter Tabs & Search */}
            <div className="space-y-2.5 mb-3 flex-shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setFilterType("ALL")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer",
                    filterType === "ALL"
                      ? "bg-[#D4F63D] text-black"
                      : "bg-[#1C1D22] text-[#8E929E] hover:text-white hover:bg-[#282A30]"
                  )}
                >
                  Toutes ({unassignedTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("CURRENT")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer",
                    filterType === "CURRENT"
                      ? "bg-[#D4F63D] text-black"
                      : "bg-[#1C1D22] text-[#8E929E] hover:text-white hover:bg-[#282A30]"
                  )}
                >
                  En cours
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("UPCOMING")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer",
                    filterType === "UPCOMING"
                      ? "bg-[#D4F63D] text-black"
                      : "bg-[#1C1D22] text-[#8E929E] hover:text-white hover:bg-[#282A30]"
                  )}
                >
                  À venir
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("PAST")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer",
                    filterType === "PAST"
                      ? "bg-[#D4F63D] text-black"
                      : "bg-[#1C1D22] text-[#8E929E] hover:text-white hover:bg-[#282A30]"
                  )}
                >
                  Passées
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher une tâche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#16171C] border border-[#282A30] focus:border-[#D4F63D] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#6B7280] outline-none transition-all"
                />
              </div>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pb-24 md:pb-4">
              {filteredTasks.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-[#16171C]/40 border border-[#282A30] rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-[#D4F63D] mb-1.5" />
                  <p className="text-xs font-semibold text-white">
                    {unassignedTasks.length === 0
                      ? "Toutes les tâches sont affectées à un projet !"
                      : "Aucune tâche trouvée pour ce filtre."}
                  </p>
                  <p className="text-[10px] text-[#8E929E] mt-0.5">
                    {unassignedTasks.length === 0
                      ? "Ton espace de travail est parfaitement organisé."
                      : "Essaie un autre filtre ou réinitialise ta recherche."}
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    projects={projects}
                    onAssignToProject={handleAssignToProject}
                    onEditTask={onEditTask}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay for active drag */}
      <DragOverlay>
        {activeTask ? (
          <div className="rounded-2xl bg-[#1F2128] border-2 border-[#D4F63D] p-3.5 shadow-2xl flex items-center gap-3 text-white max-w-sm pointer-events-none opacity-95 scale-105 rotate-1">
            <GripVertical className="w-4 h-4 text-[#D4F63D]" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{activeTask.title}</div>
              {activeTask.category && (
                <div className="text-[10px] text-[#A0A5B5]">{activeTask.category}</div>
              )}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4F63D] text-black font-extrabold">
              {zoomedProject ? "Déposer sur une catégorie" : "Déposer sur un projet"}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
