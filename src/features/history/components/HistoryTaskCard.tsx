"use client";

import React from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { CheckCircle2, Circle, Clock, Play, Check, AlertCircle, ArrowRight, Flame, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorityCardClass, getPriorityTitleClass, getPriorityIconColorClass } from "@/features/tasks/priority";
import { useProjects } from "@/features/projects/hooks";
import { isOvernightTimeRange, formatCrossDayTimeLabel } from "@/lib/dates";

interface HistoryTaskCardProps {
  task: TaskWithCompletion;
  date: string;
  onStartTask: (taskId: string) => void;
  onFinishTask: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
}

export const HistoryTaskCard: React.FC<HistoryTaskCardProps> = ({
  task,
  date,
  onStartTask,
  onFinishTask,
  onToggleComplete,
  onEditTask,
}) => {
  const { projects } = useProjects();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;

  const completion = task.completion;
  const isCompleted = Boolean(completion?.completed || task.isCompletedToday);

  const scheduledStart = task.effectiveStartTime || task.startTime || completion?.scheduledStartTime;
  const scheduledEnd = task.effectiveEndTime || task.endTime || completion?.scheduledEndTime;

  const actualStart = completion?.actualStartTime;
  const actualEnd = completion?.actualEndTime;

  const isOvernight = isOvernightTimeRange(scheduledStart, scheduledEnd);
  const scheduledTimeLabel = formatCrossDayTimeLabel(scheduledStart, scheduledEnd, task.overnightPart);

  const hasScheduledTime = Boolean(scheduledStart);
  const hasActualTime = Boolean(actualStart || actualEnd);

  return (
    <div
      style={
        project?.color
          ? {
              backgroundColor: isCompleted ? `${project.color}0D` : `${project.color}0F`,
              borderColor: isCompleted ? `${project.color}30` : `${project.color}45`,
            }
          : undefined
      }
      className={cn(
        "rounded-2xl p-4 border transition-all duration-200 shadow-sm",
        isCompleted
          ? project
            ? "opacity-85 hover:brightness-110"
            : "bg-[#141519] border-[#2A2D35]"
          : !project
          ? "bg-[#1C1D22] border-[#2E313B] hover:border-[#3E424F]"
          : "hover:brightness-110",
        !isCompleted && getPriorityCardClass(task.priority)
      )}
    >
      {/* Top row: Title and Status check */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex-1 cursor-pointer"
          onClick={() => onEditTask && onEditTask(task)}
          title="Cliquer pour éditer cette tâche"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {project && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-md bg-[#252830] text-white font-semibold border border-white/10">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#D4F63D" }} />
                <span className="truncate max-w-[120px]">{project.name}</span>
                {task.projectCategory && (
                  <span className="text-[#A5B4FC] text-[10px] font-medium border-l border-white/10 pl-1">
                    {task.projectCategory}
                  </span>
                )}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-md bg-[#252830] text-[#A0A4B0] font-semibold">
              {task.tag || task.category || "Général"}
            </span>
            <span className="text-xs text-[#8E929E] font-medium">
              {task.recurrence === "DAILY"
                ? "Quotidien"
                : task.recurrence === "WEEKDAYS"
                ? "Lun-Ven"
                : task.recurrence}
            </span>
          </div>

          <h3
            className={cn(
              "text-base font-bold mt-1 text-white leading-snug hover:text-[#D4F63D] transition-colors flex items-center gap-1.5",
              isCompleted ? "line-through text-[#8E929E]" : "",
              !isCompleted && getPriorityTitleClass(task.priority)
            )}
          >
            {task.priority && task.priority !== "NORMAL" && !isCompleted && (
              <Flame className={cn("w-3.5 h-3.5 flex-shrink-0", getPriorityIconColorClass(task.priority))} />
            )}
            <span>{task.title}</span>
          </h3>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onEditTask && (
            <button
              type="button"
              onClick={() => onEditTask(task)}
              title="Modifier la tâche"
              className="p-1 text-[#8E929E] hover:text-[#D4F63D] transition-colors rounded-lg hover:bg-[#252830] cursor-pointer"
            >
              <Clock className="w-4 h-4 hidden" />
              <span className="text-xs font-semibold text-[#8E929E] hover:text-[#D4F63D]">Éditer</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleComplete(task.id)}
            className="p-1 hover:scale-110 transition-transform cursor-pointer"
          >
            {isCompleted ? (
              <CheckCircle2
                className="w-5 h-5"
                style={{
                  color: project?.color || "#D4F63D",
                  fill: project?.color ? `${project.color}33` : "#D4F63D33",
                }}
              />
            ) : (
              <Circle className="w-5 h-5 text-[#8E929E]" />
            )}
          </button>
        </div>
      </div>

      {/* Comparison Grid: Temps Prévu vs Temps Réel */}
      <div className="mt-3 pt-3 border-t border-[#252830] grid grid-cols-2 gap-3 text-xs">
        {/* 1. Temps Prévu */}
        <div className="bg-[#121316] p-2.5 rounded-xl border border-[#202228]">
          <div className="flex items-center gap-1.5 text-[#8E929E] font-semibold mb-1">
            {isOvernight ? (
              <Moon className="w-3.5 h-3.5 text-[#A78BFA]" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />
            )}
            <span>Prévu</span>
            {isOvernight && (
              <span className="text-[9px] font-bold text-[#C4B5FD] bg-[#7C3AED]/20 px-1 py-0.2 rounded border border-[#7C3AED]/30">
                {task.overnightPart === "end" ? "Veille" : "+1j"}
              </span>
            )}
          </div>
          <div className="text-white font-medium">
            {hasScheduledTime ? (
              <span>{scheduledTimeLabel}</span>
            ) : (
              <span className="text-[#8E929E] italic">Journée entière</span>
            )}
          </div>
        </div>

        {/* 2. Temps Réel */}
        <div className="bg-[#121316] p-2.5 rounded-xl border border-[#202228]">
          <div className="flex items-center gap-1.5 text-[#8E929E] font-semibold mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#D4F63D]" />
            <span>Réalisé</span>
          </div>
          <div className="text-white font-medium">
            {hasActualTime ? (
              <span className="text-[#D4F63D] font-bold">
                {actualStart || "—"} {actualEnd ? `→ ${actualEnd}` : ""}
              </span>
            ) : isCompleted ? (
              <span className="text-[#A0A4B0]">Validé (sans chrono)</span>
            ) : (
              <span className="text-[#6B7280] italic">Non démarré</span>
            )}
          </div>
        </div>
      </div>

      {/* Real-time execution controls */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {!isCompleted ? (
          !actualStart ? (
            <button
              onClick={() => onStartTask(task.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Commencer maintenant
            </button>
          ) : (
            <button
              onClick={() => onFinishTask(task.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Terminer & Enregistrer
            </button>
          )
        ) : (
          <div
            className="w-full text-center py-1 text-[11px] font-semibold rounded-lg"
            style={
              project?.color
                ? { color: project.color, backgroundColor: `${project.color}15` }
                : { color: "#22C55E", backgroundColor: "rgba(34, 197, 94, 0.1)" }
            }
          >
            ✓ Accomplie le {date}
          </div>
        )}
      </div>
    </div>
  );
};
