"use client";

import React, { useState } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { Calendar, Clock, ChevronRight, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniAgendaWidgetProps {
  tasks: TaskWithCompletion[];
  onOpenAgenda: () => void;
  onToggleComplete?: (taskId: string) => void;
  onSelectTask?: (task: TaskWithCompletion) => void;
}

export const MiniAgendaWidget: React.FC<MiniAgendaWidgetProps> = ({
  tasks,
  onOpenAgenda,
  onToggleComplete,
  onSelectTask,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter tasks that have a start time or are scheduled for a specific time
  const timedTasks = tasks
    .filter((t) => t.effectiveStartTime || t.startTime)
    .sort((a, b) => {
      const timeA = a.effectiveStartTime || a.startTime || "00:00";
      const timeB = b.effectiveStartTime || b.startTime || "00:00";
      return timeA.localeCompare(timeB);
    });

  if (timedTasks.length === 0) {
    return null;
  }

  const completedCount = timedTasks.filter((t) => t.isCompletedToday).length;

  return (
    <div className="w-full rounded-2xl bg-[#17181F] border border-[#262834] p-3 shadow-md select-none transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-6 h-6 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white group-hover:text-[#38BDF8] transition-colors">
                Mini Agenda
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] text-[10px] font-mono font-bold">
                {timedTasks.length}
              </span>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#8E929E]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#8E929E]" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenAgenda}
          className="flex items-center gap-1 text-[11px] font-medium text-[#38BDF8] hover:text-[#7dd3fc] transition-colors cursor-pointer"
        >
          <span>Agenda</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded Content: Horizontal scrolling timeline chips */}
      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-[#262834] flex items-center gap-2 overflow-x-auto scrollbar-none touch-pan-x pb-1">
          {timedTasks.map((task) => {
            const time = task.effectiveStartTime || task.startTime;
            const isDone = task.isCompletedToday;

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask?.(task)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-xl border flex-shrink-0 transition-all cursor-pointer select-none",
                  isDone
                    ? "bg-[#1C1E26]/60 border-[#2A2D3A] opacity-60"
                    : task.isActive
                    ? "bg-[#D4F63D]/10 border-[#D4F63D]/40 text-white"
                    : "bg-[#1F212B] border-[#2E3140] hover:border-[#424658] text-white"
                )}
              >
                {/* Time Badge */}
                <span
                  className={cn(
                    "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md",
                    isDone
                      ? "bg-[#252834] text-[#8E929E] line-through"
                      : task.isActive
                      ? "bg-[#D4F63D] text-black font-bold"
                      : "bg-[#282B38] text-[#38BDF8]"
                  )}
                >
                  {time}
                </span>

                {/* Title */}
                <span
                  className={cn(
                    "text-xs font-medium max-w-[120px] truncate",
                    isDone ? "line-through text-[#8E929E]" : "text-white"
                  )}
                >
                  {task.title}
                </span>

                {/* Quick Checkbox if togglable */}
                {onToggleComplete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete(task.id);
                    }}
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer",
                      isDone
                        ? "bg-[#D4F63D] text-black"
                        : "border border-[#4B5063] hover:border-[#D4F63D] text-transparent"
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
