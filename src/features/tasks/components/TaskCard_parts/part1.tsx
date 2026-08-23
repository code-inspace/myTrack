"use client";

import React from "react";
import { TaskWithCompletion } from "../types";
import { Clock, Repeat, Play, Check, Plus, Trash2, Edit3, GripVertical, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface TaskCardProps {
  task: TaskWithCompletion;
  index?: number;
  isDraggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onToggleActive: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onOpenLogModal: (task: TaskWithCompletion) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
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
  index = 0,
  isDraggable = false,
  isDragging = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onToggleActive,
  onToggleComplete,
  onToggleReminder,
  onOpenLogModal,
  onEditTask,
  onDeleteTask,
}) => {
  const isCompleted = task.isCompletedToday;
  const isRemindersEnabled = task.enableReminders !== false;

  // No quantitative counter if it's duration / minutes (handled in real-time or agenda)
  const isDurationUnit =
    task.unit === "min" ||
    task.unit === "minute" ||
    task.unit === "minutes" ||
    task.trackingType === "DURATION";

  const isQuantitative =
    (task.trackingType === "NUMBER" || task.trackingType === "QUANTITY") &&
    !isDurationUnit;

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

  const displayStart = task.effectiveStartTime !== undefined ? task.effectiveStartTime : task.startTime;
  const displayEnd = task.effectiveEndTime !== undefined ? task.effectiveEndTime : task.endTime;
  const hasTime = Boolean(displayStart || displayEnd);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => onDragStart && onDragStart(e, index)}
      onDragOver={(e) => onDragOver && onDragOver(e, index)}
      onDragEnd={(e) => onDragEnd && onDragEnd(e)}
      style={{ touchAction: "pan-y" }}
      className={cn(
        "relative w-full rounded-2xl p-4 transition-all duration-200 border space-y-3 shadow-sm select-none touch-pan-y",
        isDragging
          ? "opacity-40 border-[#D4F63D] scale-[0.98] ring-2 ring-[#D4F63D]/50 bg-[#22242B]"
          : isCompleted
          ? "bg-[#141518]/90 border-[#23242A] opacity-75"
          : "bg-[#1C1D22] hover:bg-[#22242B] border-[#282A30] hover:border-[#383C48]"
      )}
    >
      {/* Level 1: Grip + Check Circle + Title Header + Actions on Right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Reordering Drag Handle */}
          {isDraggable && (
            <div
              className="p-1 -ml-1 text-[#6B7280] hover:text-[#D4F63D] cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors mt-0.5"
              title="Glisser pour réorganiser par priorité"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

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

          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => onEditTask && onEditTask(task)}
            title="Cliquer pour éditer cette habitude"
          >
            <h4
              className={cn(
                "text-base font-bold transition-colors leading-tight text-white break-words hover:text-[#D4F63D]",
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

        {/* Action icons: Bell Toggle, Edit & Delete */}
        <div className="flex items-center gap-1 flex-shrink-0" onPointerDown={(e) => e.stopPropagation()}>
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
                  ? "Rappels activés — Cliquer pour désactiver"
                  : "Rappels désactivés — Cliquer pour activer"
              }
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                isRemindersEnabled
                  ? "text-[#D4F63D] hover:bg-[#D4F63D]/10"
                  : "text-[#6B7280] hover:text-white hover:bg-[#282A30]"
              )}
            >
              {isRemindersEnabled ? (
                <Bell className="w-3.5 h-3.5 fill-[#D4F63D]/20" />
              ) : (
                <BellOff className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {onEditTask && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              title="Modifier l'habitude"
              className="p-1.5 text-[#8E929E] hover:text-[#D4F63D] transition-colors rounded-lg hover:bg-[#282A30] cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
            title="Supprimer la tâche"
            className="p-1.5 text-[#6B7280] hover:text-[#EF4444] transition-colors rounded-lg hover:bg-[#282A30] cursor-pointer"
          >