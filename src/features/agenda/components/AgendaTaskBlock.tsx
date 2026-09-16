"use client";

import React, { useRef } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { Flame, Repeat, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorityTitleClass, getPriorityIconColorClass } from "@/features/tasks/priority";
import { useProjects } from "@/features/projects/hooks";

interface AgendaTaskBlockProps {
  task: TaskWithCompletion;
  topOffsetPx: number;
  heightPx: number;
  leftPercent?: number;
  widthPercent?: number;
  isSelected?: boolean;
  resizingInfo?: {
    edge: "top" | "bottom";
    currentTime: string;
    fullRange: string;
    durationStr: string;
  } | null;
  onDragStart: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onClick?: () => void;
  onSelectForResize?: (task: TaskWithCompletion) => void;
  onStartResize?: (e: React.PointerEvent, task: TaskWithCompletion, edge: "top" | "bottom") => void;
}

const TAG_STYLES: Record<string, { bg: string; border: string; bar: string; text: string }> = {
  Fitness: {
    bg: "bg-[#162A20]/90",
    border: "border-[#22C55E]/40",
    bar: "bg-[#22C55E]",
    text: "text-[#86EFAC]",
  },
  Sport: {
    bg: "bg-[#162A20]/90",
    border: "border-[#22C55E]/40",
    bar: "bg-[#22C55E]",
    text: "text-[#86EFAC]",
  },
  Santé: {
    bg: "bg-[#27153B]/90",
    border: "border-[#A855F7]/40",
    bar: "bg-[#A855F7]",
    text: "text-[#D8B4FE]",
  },
  Travail: {
    bg: "bg-[#172554]/90",
    border: "border-[#3B82F6]/40",
    bar: "bg-[#3B82F6]",
    text: "text-[#93C5FD]",
  },
  Apprentissage: {
    bg: "bg-[#2C1810]/90",
    border: "border-[#F97316]/40",
    bar: "bg-[#F97316]",
    text: "text-[#FDBA74]",
  },
  General: {
    bg: "bg-[#1E2127]/90",
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
  resizingInfo = null,
  onDragStart,
  onClick,
  onSelectForResize,
  onStartResize,
}) => {
  const { projects } = useProjects();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;

  const tagKey = task.tag || task.category || "General";
  const style = TAG_STYLES[tagKey] || TAG_STYLES.General;
  const isRecurring = Boolean(task.recurrence && task.recurrence !== "ONCE");
  const startTime = (task.effectiveStartTime !== undefined ? task.effectiveStartTime : task.startTime) || "09:00";
  const endTime = task.effectiveEndTime !== undefined ? task.effectiveEndTime : task.endTime;

  const activeLeftPercent = isSelected ? 0 : leftPercent;
  const activeWidthPercent = isSelected ? 100 : widthPercent;

  // Responsive height tiers for Apple-style progressive disclosure
  const isTiny = heightPx < 18;      // 1m - 17m (e.g. 3m, 5m, 15m)
  const isCompact = heightPx >= 18 && heightPx < 36; // 18m - 35m (e.g. 20m, 30m)
  const isComfortable = heightPx >= 36 && heightPx < 56; // 36m - 55m (e.g. 45m)
  const isSpacious = heightPx >= 56; // 56m+ (e.g. 1h+)

  const isNarrow = !isSelected && widthPercent < 45;
  const isVeryNarrow = !isSelected && widthPercent < 30;

  // Long press detection for Apple-style move vs resize selection vs tap
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startCoordRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hasLongPressedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary button
    if (e.button !== 0) return;
    e.stopPropagation();

    startCoordRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    hasLongPressedRef.current = false;

    timerRef.current = setTimeout(() => {
      hasLongPressedRef.current = true;
      try {
        navigator.vibrate?.(25);
      } catch {}
      onSelectForResize?.(task);
    }, 400);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startCoordRef.current) return;
    const dx = Math.abs(e.clientX - startCoordRef.current.x);
    const dy = Math.abs(e.clientY - startCoordRef.current.y);
    if (dx > 8 || dy > 8) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const hadLongPressed = hasLongPressedRef.current;
    startCoordRef.current = null;
    hasLongPressedRef.current = false;

    if (!hadLongPressed) {
      onClick?.();
    }
  };

  const handlePointerCancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startCoordRef.current = null;
    hasLongPressedRef.current = false;
  };

  return (
    <div
      draggable
      data-agenda-block="true"
      data-task-id={task.id}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onDragStart={(e) => onDragStart(e, task)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        top: `${topOffsetPx}px`,
        height: `${heightPx}px`,
        left: `${activeLeftPercent}%`,
        width: `${activeWidthPercent}%`,
      }}
      className={cn(
        "absolute rounded-xl border transition-[top,height,box-shadow,transform] duration-75 select-none cursor-pointer flex flex-col justify-between overflow-visible",
        style.bg,
        style.border,
        isSelected
          ? "z-40 ring-1.5 ring-[#38BDF8] shadow-[0_4px_24px_rgba(56,189,248,0.4)] scale-[1.008] border-[#38BDF8] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.07)_0px,rgba(255,255,255,0.07)_6px,transparent_6px,transparent_12px)]"
          : "z-10 hover:ring-1 hover:ring-white/30 hover:z-25",
        task.isActive
          ? "ring-1 ring-[#D4F63D] shadow-[0_0_12px_rgba(212,246,61,0.3)] border-[#D4F63D]/80"
          : "",
        task.isCompletedToday ? "opacity-60 line-through" : "",
        !task.isCompletedToday && !task.isActive && task.priority === "VERY_URGENT" ? "ring-2 ring-red-500" : "",
        !task.isCompletedToday && !task.isActive && task.priority === "URGENT" ? "ring-1 ring-amber-500" : ""
      )}
    >
      {/* --- APPLE CALENDAR STYLE RESIZE HANDLES & LIVE TIME BADGES --- */}
      {isSelected && (
        <>
          {/* Top-Right circular resize handle */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartResize?.(e, task, "top");
            }}
            className="absolute -top-2.5 right-2 w-4 h-4 rounded-full bg-white border-2 border-[#38BDF8] shadow-[0_2px_8px_rgba(0,0,0,0.6)] cursor-ns-resize z-50 flex items-center justify-center hover:scale-125 active:scale-125 transition-transform touch-none after:absolute after:-inset-2.5 after:content-['']"
            title="Glisser pour modifier l'heure de début (pas de 5min)"
          >
            {/* Live floating time badge while stretching top handle */}
            {resizingInfo && resizingInfo.edge === "top" && (
              <div className="absolute -top-8 -right-2 z-50 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0F172A] border-2 border-[#38BDF8] text-[#38BDF8] shadow-[0_4px_20px_rgba(0,0,0,0.9),0_0_12px_rgba(56,189,248,0.6)] animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap">
                <Clock className="w-3 h-3 text-[#38BDF8]" />
                <span className="font-mono text-xs font-black tracking-tight text-white">{resizingInfo.currentTime}</span>
                <span className="text-[10px] text-[#94A3B8] font-semibold">({resizingInfo.durationStr})</span>
              </div>
            )}
          </div>

          {/* Bottom-Left circular resize handle */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartResize?.(e, task, "bottom");
            }}
            className="absolute -bottom-2.5 left-2 w-4 h-4 rounded-full bg-white border-2 border-[#38BDF8] shadow-[0_2px_8px_rgba(0,0,0,0.6)] cursor-ns-resize z-50 flex items-center justify-center hover:scale-125 active:scale-125 transition-transform touch-none after:absolute after:-inset-2.5 after:content-['']"
            title="Glisser pour modifier l'heure de fin (pas de 5min)"
          >
            {/* Live floating time badge while stretching bottom handle */}
            {resizingInfo && resizingInfo.edge === "bottom" && (
              <div className="absolute -bottom-8 -left-2 z-50 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0F172A] border-2 border-[#38BDF8] text-[#38BDF8] shadow-[0_4px_20px_rgba(0,0,0,0.9),0_0_12px_rgba(56,189,248,0.6)] animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap">
                <Clock className="w-3 h-3 text-[#38BDF8]" />
                <span className="font-mono text-xs font-black tracking-tight text-white">{resizingInfo.currentTime}</span>
                <span className="text-[10px] text-[#94A3B8] font-semibold">({resizingInfo.durationStr})</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Left colored accent bar */}
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 left-0.5 w-1 rounded-full",
          style.bar
        )}
      />

      {/* Inner Content - Clean Apple Calendar Progressive Disclosure */}
      <div className="h-full w-full pl-2.5 pr-1.5 overflow-hidden flex flex-col justify-center">
        {/* Tier 1: Tiny (1m - 17m) */}
        {isTiny && (
          <div className="flex items-center gap-1 min-w-0 leading-none">
            {task.isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-pulse flex-shrink-0" />
            )}
            <span
              className={cn(
                "text-[9px] font-semibold text-white truncate leading-none",
                task.isCompletedToday && "text-[#8E929E]"
              )}
            >
              {task.title}
            </span>
          </div>
        )}

        {/* Tier 2: Compact (18m - 35m) */}
        {isCompact && (
          <div className="flex items-center justify-between gap-1 min-w-0 leading-none">
            <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
              {task.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-pulse flex-shrink-0" />
              )}
              {project && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: project.color || "#D4F63D" }}
                />
              )}
              <h4
                className={cn(
                  "text-[10px] font-bold text-white truncate leading-tight",
                  task.isCompletedToday && "text-[#8E929E]"
                )}
              >
                {task.title}
              </h4>
            </div>
            <span className="text-[9px] font-mono text-[#94A3B8] flex-shrink-0">
              {startTime}
            </span>
          </div>
        )}

        {/* Tier 3: Comfortable (36m - 55m) */}
        {isComfortable && (
          <div className="flex flex-col justify-center gap-0.5 min-w-0 py-0.5">
            <div className="flex items-center gap-1 min-w-0 truncate">
              {task.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-pulse flex-shrink-0" />
              )}
              {task.priority && task.priority !== "NORMAL" && !task.isCompletedToday && (
                <Flame className={cn("w-2.5 h-2.5 flex-shrink-0", getPriorityIconColorClass(task.priority))} />
              )}
              <h4
                className={cn(
                  "text-xs font-bold text-white truncate leading-tight",
                  task.isCompletedToday && "text-[#8E929E]"
                )}
              >
                {task.title}
              </h4>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-[#94A3B8] font-mono truncate">
              <span>{startTime}{endTime ? ` - ${endTime}` : ""}</span>
              {project && (
                <span className="inline-flex items-center gap-0.5 truncate text-white/90 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#D4F63D" }} />
                  <span className="truncate max-w-[70px]">{project.name}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tier 4: Spacious (56m+) */}
        {isSpacious && (
          <div className="flex flex-col justify-between h-full py-1 min-w-0">
            <div>
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                {task.isActive && (
                  <span className="w-2 h-2 rounded-full bg-[#D4F63D] animate-pulse flex-shrink-0" />
                )}
                {task.priority && task.priority !== "NORMAL" && !task.isCompletedToday && (
                  <Flame className={cn("w-3 h-3 flex-shrink-0", getPriorityIconColorClass(task.priority))} />
                )}
                <h4
                  className={cn(
                    "text-xs font-bold text-white truncate leading-snug",
                    task.isCompletedToday && "text-[#8E929E]"
                  )}
                >
                  {task.title}
                </h4>
                {isRecurring && <Repeat className="w-2.5 h-2.5 text-[#8E929E] flex-shrink-0" />}
              </div>

              {task.description && heightPx >= 80 && (
                <p className="text-[10px] text-[#94A3B8] line-clamp-2 mt-0.5">
                  {task.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] text-[#94A3B8] font-medium pt-1 border-t border-white/5 mt-0.5">
              <span className="font-mono text-[9px] text-[#CBD5E1]">
                {startTime}{endTime ? ` - ${endTime}` : ""}
              </span>
              {project && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-black/40 text-white font-medium text-[9px] border border-white/10 truncate max-w-[90px]">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#D4F63D" }} />
                  <span className="truncate">{project.name}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
