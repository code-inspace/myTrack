"use client";

import React from "react";
import { TaskWithCompletion } from "../types";
import { Clock, Repeat, Play, Check, Plus, Trash2, Tag } from "lucide-react";
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

  return (
    <div
      className={cn(
        "group relative w-full rounded-2xl p-4 transition-all duration-200 border space-y-2.5",
        isCompleted
          ? "bg-[#141518]/90 border-[#23242A] opacity-75"
          : "bg-[#1C1D22] hover:bg-[#22242B] border-[#282A30] shadow-sm hover:border-[#353842]"
      )}
    >
      {/* Top Row: Check Circle + Full Title + Action Buttons */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
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

          <h4
            className={cn(
              "text-base font-bold transition-colors leading-tight flex-1 break-words",
              isCompleted ? "text-[#8E929E] line-through" : "text-[#F3F4F6]"
            )}
          >
            {task.title}
          </h4>
        </div>

        {/* Top Right: Start action & Delete */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isCompleted && (
            <button
              onClick={() => onToggleActive(task.id)}
              className="bg-[#282A30] hover:bg-[#D4F63D] hover:text-black text-[#E5E7EB] active:scale-95 px-3 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Démarrer</span>
            </button>
          )}

          <button
            onClick={() => onDeleteTask(task.id)}
            title="Supprimer la tâche"
            className="opacity-70 group-hover:opacity-100 p-1.5 text-[#6B7280] hover:text-[#F87171] transition-all rounded-lg hover:bg-[#282A30] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Metadata badges (Time, Recurrence, Quantitative logger) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-t border-[#252830]/60 text-[11px] text-[#8E929E]">
        {/* Left Metadata pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(task.startTime || task.endTime) && (
            <div className="flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-md border border-[#252830]">
              <Clock className="w-3 h-3 text-[#D4F63D]" />
              <span className="font-semibold text-[#D1D5DB]">
                {task.startTime || "05:30"}
                {task.endTime ? ` - ${task.endTime}` : ""}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-md border border-[#252830]">
            <Repeat className="w-3 h-3 text-[#8E929E]" />
            <span>{RECURRENCE_LABEL_MAP[task.recurrence] || "Quotidien"}</span>
          </div>

          {task.category && task.category !== "General" && (
            <span className="px-2 py-0.5 rounded-md bg-[#252830] text-[#9CA3AF] font-medium">
              {task.category}
            </span>
          )}
        </div>

        {/* Right Quantitative Counter Badge */}
        {isQuantitative && (
          <button
            onClick={() => onOpenLogModal(task)}
            className="px-2.5 py-1 rounded-lg bg-[#252830] hover:bg-[#343740] font-bold text-[#D1D5DB] transition-all flex items-center gap-1.5 cursor-pointer border border-[#343742]"
            title="Modifier la quantité ou durée"
          >
            <span className={cn(task.currentValue ? "text-[#D4F63D]" : "text-[#9CA3AF]")}>
              {task.currentValue ?? 0}
            </span>
            {task.targetValue && (
              <span className="text-[#6B7280]">/ {task.targetValue}</span>
            )}
            {task.unit && <span className="text-[#9CA3AF] text-[10px]">{task.unit}</span>}
            <Plus className="w-3 h-3 text-[#D4F63D] ml-0.5" />
          </button>
        )}
      </div>
    </div>
  );
};
