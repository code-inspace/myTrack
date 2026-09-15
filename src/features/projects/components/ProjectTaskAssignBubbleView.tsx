"use client";

import React, { useState, useMemo } from "react";
import { Task } from "@/features/tasks/types";
import { Project } from "../types";
import { useTaskMutations } from "@/features/tasks/hooks";
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
  AlertCircle,
  Plus,
  Layers,
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
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface ProjectTaskAssignBubbleViewProps {
  projects: Project[];
  tasks: Task[];
  onBack: () => void;
  onEditTask: (task: Task) => void;
}

// Unequal bubble dimension variations
const BUBBLE_SIZES = [
  { sizeClass: "w-36 h-36 md:w-40 md:h-40", minDim: 144, labelClass: "text-sm", countClass: "text-xs" },
  { sizeClass: "w-28 h-28 md:w-32 md:h-32", minDim: 112, labelClass: "text-xs", countClass: "text-[10px]" },
  { sizeClass: "w-44 h-44 md:w-48 md:h-48", minDim: 176, labelClass: "text-base font-bold", countClass: "text-xs" },
  { sizeClass: "w-32 h-32 md:w-36 md:h-36", minDim: 128, labelClass: "text-xs", countClass: "text-[11px]" },
  { sizeClass: "w-40 h-40 md:w-44 md:h-44", minDim: 160, labelClass: "text-sm font-semibold", countClass: "text-xs" },
  { sizeClass: "w-30 h-30 md:w-34 md:h-34", minDim: 120, labelClass: "text-xs", countClass: "text-[10px]" },
];

// Project Droppable Bubble
function ProjectDroppableBubble({
  project,
  index,
  taskCount,
  isOverTarget,
}: {
  project: Project;
  index: number;
  taskCount: number;
  isOverTarget: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `project-${project.id}`,
    data: { project },
  });

  const activeIsOver = isOver || isOverTarget;
  const config = BUBBLE_SIZES[index % BUBBLE_SIZES.length];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-full flex flex-col items-center justify-center text-center p-3 transition-all duration-300 select-none cursor-pointer flex-shrink-0 group",
        config.sizeClass,
        activeIsOver
          ? "scale-110 shadow-2xl z-20"
          : "hover:scale-105 shadow-lg hover:shadow-xl"
      )}
      style={{
        backgroundColor: activeIsOver ? `${project.color}33` : "#16181D",
        borderColor: activeIsOver ? project.color : `${project.color}55`,
        borderWidth: activeIsOver ? "3px" : "2px",
        boxShadow: activeIsOver
          ? `0 0 35px ${project.color}66, 0 0 10px ${project.color}`
          : `0 4px 20px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Background glow subtle gradient */}
      <div
        className="absolute inset-0 rounded-full opacity-20 pointer-events-none group-hover:opacity-35 transition-opacity"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${project.color}, transparent 70%)`,
        }}
      />

      {/* Floating indicator icon */}
      <div
        className="w-3 h-3 rounded-full mb-1.5 shadow-sm flex-shrink-0"
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
          className="mt-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold text-black flex items-center gap-1 animate-bounce"
          style={{ backgroundColor: project.color }}
        >
          <Plus className="w-3 h-3" />
          Déposer ici
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
  onAssignToProject: (taskId: string, projectId: string) => void;
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
                      onAssignToProject(task.id, p.id);
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overProjectId, setOverProjectId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "CURRENT" | "UPCOMING" | "PAST">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedToast, setAssignedToast] = useState<{ taskTitle: string; projectName: string } | null>(null);

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

  const handleAssignToProject = (taskId: string, projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const task = tasks.find((t) => t.id === taskId);
    if (!project || !task) return;

    const firstColumnId = project.columns && project.columns.length > 0 ? project.columns[0].id : "TODO";

    updateTask.mutate({
      taskId,
      values: {
        projectId: project.id,
        projectStatus: firstColumnId,
      },
    });

    setAssignedToast({
      taskTitle: task.title,
      projectName: project.name,
    });
    setTimeout(() => {
      setAssignedToast(null);
    }, 3000);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task;
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: any) => {
    const overId = event.over?.id ? String(event.over.id) : null;
    if (overId && overId.startsWith("project-")) {
      setOverProjectId(overId.replace("project-", ""));
    } else {
      setOverProjectId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverProjectId(null);

    if (!over) return;

    const overId = String(over.id);
    if (overId.startsWith("project-")) {
      const targetProjectId = overId.replace("project-", "");
      const taskId = String(active.id).replace("task-", "");
      handleAssignToProject(taskId, targetProjectId);
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
        {/* Top Header */}
        <div className="p-4 border-b border-[#202228] bg-[#111214] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-[#1C1D22] hover:bg-[#282A30] text-[#8E929E] hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4F63D]" />
                <span>Affecter les tâches à un projet</span>
              </h1>
              <p className="text-xs text-[#8E929E]">
                Glisse et dépose les tâches sur les bulles de projet ci-dessous
              </p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[#D4F63D]/10 border border-[#D4F63D]/20 text-[#D4F63D] text-xs font-bold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>{unassignedTasks.length} sans projet</span>
          </div>
        </div>

        {/* Assigned success toast banner */}
        {assignedToast && (
          <div className="bg-[#D4F63D] text-black px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              &ldquo;{assignedToast.taskTitle}&rdquo; a été affectée au projet &ldquo;{assignedToast.projectName}&rdquo; !
            </span>
          </div>
        )}

        {/* Main Content Area: Floating Project Bubbles (Top) + Unassigned Tasks List (Bottom) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Project Bubbles Orbit Area */}
          <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r border-[#202228] bg-[#121318] flex flex-col md:w-5/12 lg:w-4/12 flex-shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8E929E] flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-[#D4F63D]" />
                Projets ({projects.length})
              </span>
              <span className="text-[10px] text-[#6B7280]">Zones de dépôt</span>
            </div>

            {/* Bubble cluster with unequal sizes */}
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 py-2 min-h-[160px] md:min-h-[300px]">
              {projects.map((project, idx) => (
                <ProjectDroppableBubble
                  key={project.id}
                  project={project}
                  index={idx}
                  taskCount={taskCountByProjectId[project.id] || 0}
                  isOverTarget={overProjectId === project.id}
                />
              ))}
            </div>
          </div>

          {/* Unassigned Tasks List Section */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0E0F12] p-4 md:p-6 overflow-hidden">
            {/* Filter Tabs & Search */}
            <div className="space-y-3 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setFilterType("ALL")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
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
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
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
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
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
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
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
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher une tâche non assignée..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#16171C] border border-[#282A30] focus:border-[#D4F63D] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#6B7280] outline-none transition-all"
                />
              </div>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredTasks.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#16171C]/40 border border-[#282A30] rounded-2xl">
                  <CheckCircle2 className="w-8 h-8 text-[#D4F63D] mb-2" />
                  <p className="text-sm font-semibold text-white">
                    {unassignedTasks.length === 0
                      ? "Toutes les tâches sont affectées à un projet !"
                      : "Aucune tâche trouvée pour ce filtre."}
                  </p>
                  <p className="text-xs text-[#8E929E] mt-1">
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
              Déposer sur une bulle
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
