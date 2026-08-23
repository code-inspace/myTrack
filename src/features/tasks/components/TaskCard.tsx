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
  WEEKLY: "Hebdomadaire",
  CUSTOM: "Personnalisé",
  ONCE: "Une fois",
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

  return (
    <div
      className={cn(
        "group relative w-full rounded-2xl p-4 transition-all duration-200 border",
        isCompleted
          ? "bg-[#16171B]/90 border-[#23242A] opacity-75"
          : "bg-[#1C1D22] hover:bg-[#22242B] border-[#282A30] shadow-sm hover:border-[#353842]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Radio / Check toggle circle + Title */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <button
            onClick={handleCircleClick}
            aria-label={isCompleted ? "Marquer comme non fait" : "Marquer comme fait"}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 border-2",
              isCompleted
                ? "bg-[#D4F63D] border-[#D4F63D] text-black"
                : "border-[#4E525F] hover:border-[#D4F63D] bg-transparent"
            )}
          >
            {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </button>

          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                "text-base font-semibold truncate transition-colors",
                isCompleted ? "text-[#8E929E] line-through" : "text-[#F3F4F6]"
              )}
            >
              {task.title}
            </h4>

            {/* Sub-info: Time and Recurrence */}
            <div className="flex items-center gap-3 text-xs text-[#8E929E] mt-1 font-medium">
              {(task.startTime || task.endTime) && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#6B7280]" />
                  <span>
                    {task.startTime || "05:30"}
                    {task.endTime ? ` - ${task.endTime}` : ""}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Repeat className="w-3 h-3 text-[#6B7280]" />
                <span>{RECURRENCE_LABEL_MAP[task.recurrence] || "Quotidien"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Start pill or Quantitative progress */}
        <div className="flex items-center gap-2">
          {isQuantitative && (
            <button
              onClick={() => onOpenLogModal(task)}
              className="px-2.5 py-1 rounded-lg bg-[#282A30] hover:bg-[#343740] text-xs font-semibold text-[#D1D5DB] transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className={cn(task.currentValue ? "text-[#D4F63D] font-bold" : "text-[#9CA3AF]")}>
                {task.currentValue ?? 0}
              </span>
              {task.targetValue && (
                <span className="text-[#6B7280]">/ {task.targetValue}</span>
              )}
              {task.unit && <span className="text-[#9CA3AF]">{task.unit}</span>}
              <Plus className="w-3 h-3 text-[#8E929E] ml-0.5" />
            </button>
          )}

          {!isCompleted && (
            <button
              onClick={() => onToggleActive(task.id)}
              className="bg-[#282A30] hover:bg-white hover:text-black text-[#E5E7EB] active:scale-95 px-4 py-1.5 rounded-full font-semibold text-xs transition-all cursor-pointer flex items-center gap-1"
            >
              <Play className="w-3 h-3 fill-current" />
              Démarrer
            </button>
          )}

          {/* Delete action button on hover */}
          <button
            onClick={() => onDeleteTask(task.id)}
            title="Supprimer la tâche"
            className="opacity-0 group-hover:opacity-100 p-1.5 text-[#6B7280] hover:text-[#F87171] transition-all rounded-lg hover:bg-[#282A30]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
