"use client";

import React from "react";
import { TaskWithCompletion } from "../types";
import { Clock, Repeat, Play, Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface TaskCardProps {
  task: TaskWithCompletion;
  onToggleActive: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onOpenLogModal: (task: TaskWithCompletion) => void;
  onDeleteTask: (taskId: string) => void;
}

const RECURRENCE_LABEL_MAP: Record<string, string> = {
  DAILY: "Quotidien",
  WEEKDAYS: "Lun - Ven",
  WEEKLY: "Hebdo",
  CUSTOM: "Perso",
  ONCE: "1 fois",
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleActive,
  onToggleComplete,
  onOpenLogModal,
  onDeleteTask,
}) => {
  const isCompleted = task.isCompletedToday;
  const isQuantitative =
    task.trackingType === "NUMBER" ||
    task.trackingType === "QUANTITY" ||
    task.trackingType === "DURATION";

  const handleCircleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCompleted) {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.8 },
        colors: ["#D4F63D", "#34D399", "#FFFFFF"],
      });
    }
    onToggleComplete(task.id);
  };

  const hasTime = Boolean(task.startTime || task.endTime);

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl p-4 transition-all duration-200 border space-y-3 shadow-sm",
        isCompleted
          ? "bg-[#141518]/90 border-[#23242A] opacity-75"
          : "bg-[#1C1D22] hover:bg-[#22242B] border-[#282A30] hover:border-[#383C48]"
      )}
    >
      {/* Level 1: Full Title Header with Check Circle on Left and Delete on Right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={handleCircleClick}
            aria-label={isCompleted ? "Marquer comme non fait" : "Marquer comme fait"}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 border-2 mt-0.5",
              isCompleted
                ? "bg-[#D4F63D] border-[#D4F63D] text-black shadow-sm"
                : "border-[#4E525F] hover:border-[#D4F63D] bg-transparent"
            )}
          >
            {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
          </button>

          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                "text-base font-bold transition-colors leading-tight text-white break-words",
                isCompleted ? "text-[#8E929E] line-through" : "text-[#F3F4F6]"
              )}
            >
              {task.title}
            </h4>

            {task.description && (
              <p className="text-xs text-[#8E929E] mt-0.5 truncate">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Delete action button */}
        <button
          onClick={() => onDeleteTask(task.id)}
          title="Supprimer la tâche"
          className="p-1 text-[#6B7280] hover:text-[#EF4444] transition-colors rounded-lg hover:bg-[#282A30] cursor-pointer flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Level 2: Metadata Badges (Hours, Recurrence, Category) & Action Controls */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#252830] text-xs">
        {/* Left Metadata Pills */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {hasTime && (
            <span className="flex items-center gap-1 bg-[#141518] px-2.5 py-1 rounded-lg border border-[#252830] font-semibold text-white text-[11px]">
              <Clock className="w-3 h-3 text-[#D4F63D]" />
              <span>
                {task.startTime || "05:30"}
                {task.endTime ? ` - ${task.endTime}` : ""}
              </span>
            </span>
          )}

          <span className="flex items-center gap-1 bg-[#141518] px-2 py-1 rounded-lg border border-[#252830] text-[#8E929E] text-[11px] font-medium">
            <Repeat className="w-3 h-3 text-[#6B7280]" />
            <span>{RECURRENCE_LABEL_MAP[task.recurrence] || "Quotidien"}</span>
          </span>

          {task.category && task.category !== "General" && (
            <span className="px-2 py-0.5 rounded-md bg-[#252830] text-[#9CA3AF] text-[10px] font-semibold">
              {task.category}
            </span>
          )}
        </div>

        {/* Right Actions: Quantitative logger & Start pill */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isQuantitative && (
            <button
              onClick={() => onOpenLogModal(task)}
              className="px-2.5 py-1 rounded-xl bg-[#252830] hover:bg-[#343740] text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer border border-[#383C48]"
              title="Modifier la progression"
            >
              <span className={cn(task.currentValue ? "text-[#D4F63D]" : "text-[#9CA3AF]")}>
                {task.currentValue ?? 0}
              </span>
              {task.targetValue && (
                <span className="text-[#6B7280]">/ {task.targetValue}</span>
              )}
              {task.unit && <span className="text-[#9CA3AF] text-[10px]">{task.unit}</span>}
              <Plus className="w-3.5 h-3.5 text-[#D4F63D] ml-0.5" />
            </button>
          )}

          {!isCompleted && (
            <button
              onClick={() => onToggleActive(task.id)}
              className="px-3.5 py-1.5 rounded-full bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-xs flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Démarrer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
