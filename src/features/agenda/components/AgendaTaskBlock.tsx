"use client";

import React, { useState } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { CheckCircle2, Circle, Repeat, GripHorizontal, Bell, BellOff, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaTaskBlockProps {
  task: TaskWithCompletion;
  topOffsetPx: number;
  heightPx: number;
  leftPercent?: number;
  widthPercent?: number;
  isSelected?: boolean;
  onToggleComplete: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
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
  leftPercent = 0,
  widthPercent = 100,
  isSelected = false,
  onToggleComplete,
  onToggleReminder,
  onEditTask,
  onDragStart,
  onClick,
  onStartResize,
}) => {
  const style = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.General;
  const isRecurring = task.recurrence && task.recurrence !== "ONCE";
  const startTime = (task.effectiveStartTime !== undefined ? task.effectiveStartTime : task.startTime) || "09:00";
  const endTime = task.effectiveEndTime !== undefined ? task.effectiveEndTime : task.endTime;
  const isRemindersEnabled = task.enableReminders !== false;

  const isNarrow = widthPercent < 45;
  const isVeryNarrow = widthPercent < 30; // 4 columns or more (e.g. 25% width)

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.setData("taskId", task.id);
        onDragStart(e, task);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        top: `${topOffsetPx}px`,
        height: `${Math.max(32, heightPx)}px`,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
      }}
      className={cn(
        "absolute rounded-xl border flex flex-col justify-between shadow-md transition-all select-none cursor-grab active:cursor-grabbing z-10 group overflow-hidden",
        isVeryNarrow ? "p-1" : isNarrow ? "p-1.5" : "p-2",
        style.bg,
        style.border,
        isSelected
          ? "ring-2 ring-[#D4F63D] shadow-2xl z-30 scale-[1.008] border-transparent"
          : "hover:ring-1 hover:ring-white/20",
        task.isActive
          ? "ring-1 ring-[#D4F63D] shadow-[0_0_15px_rgba(212,246,61,0.25)] border-[#D4F63D]/60 z-20"
          : "",
        task.isCompletedToday ? "opacity-60 bg-[#15161A] border-[#2A2D35]" : ""
      )}
    >
      {/* Left colored indicator bar */}
      <div
        className={cn(
          "absolute top-1 bottom-1 rounded-full",
          isVeryNarrow ? "left-1 w-0.5" : "left-1.5 w-1",
          style.bar
        )}
      />

      {/* Content */}
      <div
        className={cn(
          "flex items-start justify-between gap-1 overflow-hidden",
          isVeryNarrow ? "pl-1.5" : "pl-2.5"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {task.isActive && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-pulse flex-shrink-0" />
            )}
            <h4
              className={cn(
                "font-bold truncate text-white leading-tight",
                isVeryNarrow ? "text-[10px]" : "text-xs",
                task.isCompletedToday ? "line-through text-[#8E929E]" : ""
              )}
              title={task.title}
            >
              {task.title}
            </h4>
            {isRecurring && !isVeryNarrow && (
              <Repeat className="w-2.5 h-2.5 text-[#8E929E] flex-shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-[#94A3B8] font-medium truncate">
            <span className="font-mono truncate">
              {startTime}
              {task.isActive ? (
                <strong className="text-[#D4F63D] font-bold">
                  {isVeryNarrow ? " • Live" : ` - En cours (${endTime || "now"})`}
                </strong>
              ) : endTime ? (
                ` - ${endTime}`
              ) : (
                ""
              )}
            </span>
            {task.category && !isNarrow && (
              <span className={cn("px-1.5 py-0.2 rounded font-semibold text-[9px]", style.text)}>
                {task.category}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {/* Bell notification toggle (hidden on very narrow 4-col view to keep clean) */}
          {onToggleReminder && !isVeryNarrow && (
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
                  ? "Rappels activés (10 min avant) — Cliquer pour désactiver"
                  : "Rappels désactivés — Cliquer pour activer"
              }
              className="p-0.5 rounded-lg transition-transform hover:scale-110 cursor-pointer"
            >
              {isRemindersEnabled ? (
                <Bell className="w-3 h-3 text-[#D4F63D] fill-[#D4F63D]/25" />
              ) : (
                <BellOff className="w-3 h-3 text-[#717684] hover:text-white" />
              )}
            </button>
          )}

          {/* Explicit Edit Button */}
          {onEditTask && !isVeryNarrow && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              title="Modifier l'événement"
              className="p-0.5 text-[#8E929E] hover:text-[#D4F63D] hover:scale-110 transition-all rounded-lg cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}

          {/* Completion check */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            }}
            className="p-0.5 text-[#D4F63D] hover:scale-110 transition-transform cursor-pointer"
          >
            {task.isCompletedToday ? (
              <CheckCircle2 className={cn(isVeryNarrow ? "w-3 h-3" : "w-3.5 h-3.5", "fill-[#D4F63D]/20 text-[#D4F63D]")} />
            ) : (
              <Circle className={cn(isVeryNarrow ? "w-3 h-3" : "w-3.5 h-3.5", "text-[#8E929E]")} />
            )}
          </button>
        </div>
      </div>

      {/* Interactive Bottom Resize Handle for stretching / compressing duration */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartResize?.(e, task);
        }}
        className={cn(
          "absolute bottom-0 inset-x-0 h-4 flex items-center justify-center cursor-ns-resize z-40 bg-gradient-to-t from-black/50 to-transparent rounded-b-xl transition-all",
          isSelected
            ? "opacity-100 bg-[#D4F63D]/20"
            : "opacity-0 group-hover:opacity-100 hover:bg-[#D4F63D]/20"
        )}
        title="Glisser vers le bas/haut pour étendre ou compresser la durée"
      >
        <div className="w-10 h-1 bg-[#D4F63D] rounded-full shadow-lg" />
      </div>
    </div>
  );
};
