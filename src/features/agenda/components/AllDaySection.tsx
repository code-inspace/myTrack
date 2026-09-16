"use client";

import React, { useState } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { CheckCircle2, Circle, Sparkles, Bell, BellOff, Edit3, Flame, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorityIconColorClass } from "@/features/tasks/priority";
import { useProjects } from "@/features/projects/hooks";

interface AllDaySectionProps {
  tasks: TaskWithCompletion[];
  onToggleComplete: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
  onDropToAllDay: (taskId: string) => void;
  onDragStartTask: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onSelectTask?: (task: TaskWithCompletion) => void;
}

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Fitness: { bg: "bg-[#1E3A2B]", text: "text-[#4ADE80]", border: "border-[#22C55E]/30" },
  Sport: { bg: "bg-[#1E3A2B]", text: "text-[#4ADE80]", border: "border-[#22C55E]/30" },
  Santé: { bg: "bg-[#2E1A47]", text: "text-[#C084FC]", border: "border-[#A855F7]/30" },
  Travail: { bg: "bg-[#1E293B]", text: "text-[#60A5FA]", border: "border-[#3B82F6]/30" },
  Apprentissage: { bg: "bg-[#3B2818]", text: "text-[#FB923C]", border: "border-[#F97316]/30" },
  General: { bg: "bg-[#252830]", text: "text-[#E2E8F0]", border: "border-[#475569]/40" },
};

export const AllDaySection: React.FC<AllDaySectionProps> = ({
  tasks,
  onToggleComplete,
  onToggleReminder,
  onEditTask,
  onDropToAllDay,
  onDragStartTask,
  onSelectTask,
}) => {
  const { projects } = useProjects();
  const [isOver, setIsOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setIsOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    let taskId = e.dataTransfer.getData("taskId");
    if (!taskId) {
      taskId = e.dataTransfer.getData("text/plain");
    }

    if (taskId) {
      onDropToAllDay(taskId);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex border-b border-[#23242A] min-h-[58px] transition-all duration-200 select-none relative z-20",
        isOver
          ? "bg-[#D4F63D]/20 ring-2 ring-[#D4F63D] ring-inset shadow-[0_0_20px_rgba(212,246,61,0.2)]"
          : "bg-[#141518]"
      )}
    >
      {/* Left label column (matching screenshot "Jour entier") */}
      <div className="w-16 flex-shrink-0 p-2 border-r border-[#23242A] flex flex-col justify-center items-center text-center gap-1.5">
        <span className="text-[10px] font-bold text-[#8E929E] uppercase tracking-tighter leading-tight">
          Jour<br />entier
        </span>
        {tasks.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            title={isExpanded ? "Réduire" : "Agrandir"}
            className="p-1 rounded-lg text-[#8E929E] hover:text-white hover:bg-[#22242B] transition-colors cursor-pointer"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
          </button>
        )}
      </div>

      {/* Right container: horizontal flex wrap badge cards, capped so it never hides the timeline below */}
      <div
        className={cn(
          "flex-1 p-2 flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-auto transition-all duration-200",
          isExpanded ? "max-h-[220px]" : "max-h-[52px]"
        )}
      >
        {tasks.length === 0 ? (
          <div className="text-xs text-[#8E929E] italic px-2 py-1 flex items-center gap-1.5 pointer-events-none">
            <Sparkles className="w-3.5 h-3.5 text-[#D4F63D]" />
            <span>Glisse une tâche ici pour la journée entière</span>
          </div>
        ) : (
          tasks.map((task) => {
            const tagKey = task.tag || task.category || "General";
            const style = TAG_COLORS[task.tag || task.category || "General"] || TAG_COLORS.General;
            const isRemindersEnabled = task.enableReminders !== false;
            const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;

            return (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", task.id);
                  e.dataTransfer.setData("taskId", task.id);
                  onDragStartTask(e, task);
                }}
                style={
                  project?.color
                    ? {
                        backgroundColor: `${project.color}22`,
                        borderColor: `${project.color}60`,
                      }
                    : undefined
                }
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing hover:scale-[1.03] hover:ring-1 hover:ring-white/30",
                  !project && style.bg,
                  !project && style.text,
                  !project && style.border,
                  project && "text-white",
                  task.isCompletedToday ? "opacity-60 line-through" : "",
                  !task.isCompletedToday && task.priority === "VERY_URGENT" ? "ring-2 ring-red-500" : "",
                  !task.isCompletedToday && task.priority === "URGENT" ? "ring-1 ring-amber-500" : ""
                )}
                title="Glisse vers la timeline pour définir une heure"
              >
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(task.id);
                  }}
                  className="hover:scale-110 transition-transform cursor-pointer"
                >
                  {task.isCompletedToday ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D4F63D] fill-[#D4F63D]/20" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 opacity-60" />
                  )}
                </button>
                {project && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 text-white font-medium text-[9px] border border-white/10 flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#D4F63D" }} />
                    <span className="truncate max-w-[70px]">{project.name}</span>
                  </span>
                )}
                {task.priority && task.priority !== "NORMAL" && !task.isCompletedToday && (
                  <Flame className={cn("w-3 h-3 flex-shrink-0", getPriorityIconColorClass(task.priority))} />
                )}
                <span className="truncate max-w-[140px]">{task.title}</span>

                {/* Bell notification toggle */}
                {onToggleReminder && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleReminder(task.id);
                    }}
                    title={
                      isRemindersEnabled
                        ? "Rappels activés (11h & 18h) — Cliquer pour désactiver"
                        : "Rappels désactivés — Cliquer pour activer"
                    }
                    className="hover:scale-115 transition-transform cursor-pointer ml-0.5 p-0.5 text-current opacity-80 hover:opacity-100"
                  >
                    {isRemindersEnabled ? (
                      <Bell className="w-3 h-3 text-[#D4F63D] fill-[#D4F63D]/30" />
                    ) : (
                      <BellOff className="w-3 h-3 opacity-50 hover:opacity-100" />
                    )}
                  </button>
                )}

                {/* Explicit Edit Button */}
                {onEditTask && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTask(task);
                    }}
                    title="Modifier la tâche"
                    className="hover:scale-115 transition-transform cursor-pointer ml-0.5 p-0.5 text-current opacity-70 hover:opacity-100"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
