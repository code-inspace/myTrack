"use client";

import React from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { CheckCircle2, Circle, Clock, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaTaskBlockProps {
  task: TaskWithCompletion;
  topOffsetPx: number;
  heightPx: number;
  onToggleComplete: (taskId: string) => void;
  onDragStart: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onClick?: () => void;
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
  onToggleComplete,
  onDragStart,
  onClick,
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
        height: `${Math.max(38, heightPx)}px`,
      }}
      className={cn(
        "absolute left-2 right-2 rounded-xl border p-2 flex flex-col justify-between shadow-md transition-all select-none cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-white/20 z-10",
        style.bg,
        style.border,
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
            <span>
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
    </div>
  );
};
