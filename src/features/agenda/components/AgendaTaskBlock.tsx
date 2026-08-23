"use client";

import React, { useState } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { CheckCircle2, Circle, Repeat, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaTaskBlockProps {
  task: TaskWithCompletion;
  topOffsetPx: number;
  heightPx: number;
  isSelected?: boolean;
  onToggleComplete: (taskId: string) => void;
  onDragStart: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onClick?: () => void;
  onStartResize?: (e: React.PointerEvent, task: TaskWithCompletion) => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; border: string; bar: string; text: string }> = {
  Fitness: {
    bg: "bg-[#162A20]",
    border: "border-[#22C55E]/40",
    bar: "bg-[#22C55E]",
    text: "text-[#86EFAC]",
  },
  Sport: {
    bg: "bg-[#162A20]",
    border: "border-[#22C55E]/40",
    bar: "bg-[#22C55E]",
    text: "text-[#86EFAC]",
  },
  Santé: {
    bg: "bg-[#27153B]",
    border: "border-[#A855F7]/40",
    bar: "bg-[#A855F7]",
    text: "text-[#D8B4FE]",
  },
  Travail: {
    bg: "bg-[#172554]",
    border: "border-[#3B82F6]/40",
    bar: "bg-[#3B82F6]",
    text: "text-[#93C5FD]",
  },
  Apprentissage: {
    bg: "bg-[#2C1810]",
    border: "border-[#F97316]/40",
    bar: "bg-[#F97316]",
    text: "text-[#FDBA74]",
  },
  General: {
    bg: "bg-[#1E2127]",
    border: "border-[#3A3F4D]",
    bar: "bg-[#94A3B8]",
    text: "text-[#E2E8F0]",
  },
};

export const AgendaTaskBlock: React.FC<AgendaTaskBlockProps> = ({
  task,
  topOffsetPx,
  heightPx,
  isSelected = false,
  onToggleComplete,
  onDragStart,
  onClick,
  onStartResize,
}) => {
  const style = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.General;
  const isRecurring = task.recurrence && task.recurrence !== "ONCE";
  const startTime = task.effectiveStartTime || task.startTime || "09:00";
  const endTime = task.effectiveEndTime || task.endTime;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={onClick}
      style={{
        top: `${topOffsetPx}px`,
        height: `${Math.max(30, heightPx)}px`,
      }}
      className={cn(
        "absolute left-2 right-2 rounded-xl border p-2 flex flex-col justify-between shadow-md transition-all select-none cursor-grab active:cursor-grabbing z-10 group",
        style.bg,
        style.border,
        isSelected
          ? "ring-2 ring-[#D4F63D] shadow-2xl z-30 scale-[1.008] border-transparent"
          : "hover:ring-1 hover:ring-white/20",
        task.isCompletedToday ? "opacity-60 bg-[#15161A] border-[#2A2D35]" : ""
      )}
    >
      {/* Left colored indicator bar */}
      <div className={cn("absolute left-1.5 top-1.5 bottom-1.5 w-1 rounded-full", style.bar)} />

      {/* Content */}
      <div className="pl-2.5 flex items-start justify-between gap-1 overflow-hidden">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4
              className={cn(
                "text-xs font-bold truncate text-white leading-tight",
                task.isCompletedToday ? "line-through text-[#8E929E]" : ""
              )}
            >
              {task.title}
            </h4>
            {isRecurring && (
              <Repeat className="w-3 h-3 text-[#8E929E] flex-shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#94A3B8] font-medium">
            <span className="font-mono">
              {startTime}
              {endTime ? ` - ${endTime}` : ""}
            </span>
            {task.category && (
              <span className={cn("px-1.5 py-0.2 rounded font-semibold", style.text)}>
                {task.category}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id);
          }}
          className="p-1 text-[#D4F63D] hover:scale-110 transition-transform cursor-pointer"
        >
          {task.isCompletedToday ? (
            <CheckCircle2 className="w-4 h-4 fill-[#D4F63D]/20 text-[#D4F63D]" />
          ) : (
            <Circle className="w-4 h-4 text-[#8E929E]" />
          )}
        </button>
      </div>

      {/* Interactive Bottom Resize Handle (Enabled on click / selection) */}
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, task);
          }}
          className="absolute bottom-0 inset-x-0 h-4 flex items-center justify-center cursor-ns-resize z-40 bg-gradient-to-t from-black/40 to-transparent rounded-b-xl hover:bg-[#D4F63D]/20 transition-colors"
          title="Glisser pour modifier la durée"
        >
          <div className="w-8 h-1 bg-[#D4F63D] rounded-full shadow-md" />
        </div>
      )}
    </div>
  );
};
