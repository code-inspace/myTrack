"use client";

import React, { useState } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { CheckCircle2, Circle, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AllDaySectionProps {
  tasks: TaskWithCompletion[];
  onToggleComplete: (taskId: string) => void;
  onDropToAllDay: (taskId: string) => void;
  onDragStartTask: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onSelectTask?: (task: TaskWithCompletion) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Fitness: { bg: "bg-[#1E3A2B]", text: "text-[#4ADE80]", border: "border-[#22C55E]/30" },
  Sport: { bg: "bg-[#1E3A2B]", text: "text-[#4ADE80]", border: "border-[#22C55E]/30" },
  Santé: { bg: "bg-[#2E1A47]", text: "text-[#C084FC]", border: "border-[#A855F7]/30" },
  Travail: { bg: "bg-[#1E293B]", text: "text-[#60A5FA]", border: "border-[#3B82F6]/30" },
  Apprentissage: { bg: "bg-[#3B2818]", text: "text-[#FB923C]", border: "border-[#F97316]/30" },
  General: { bg: "bg-[#252830]", text: "text-[#E2E8F0]", border: "border-[#475569]/40" },
};

export const AllDaySection: React.FC<AllDaySectionProps> = ({
  tasks,
  onToggleComplete,
  onDropToAllDay,
  onDragStartTask,
  onSelectTask,
}) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const taskId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("taskId");
    if (taskId) {
      onDropToAllDay(taskId);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex border-b border-[#23242A] min-h-[58px] transition-colors duration-200",
        isOver ? "bg-[#D4F63D]/10 ring-2 ring-[#D4F63D] ring-inset" : "bg-[#141518]"
      )}
    >
      {/* Left label column (matching screenshot "Jour entier") */}
      <div className="w-16 flex-shrink-0 p-2.5 border-r border-[#23242A] flex flex-col justify-center items-center text-center">
        <span className="text-[10px] font-bold text-[#8E929E] uppercase tracking-tighter leading-tight">
          Jour<br />entier
        </span>
      </div>

      {/* Right container: horizontal flex wrap badge cards */}
      <div className="flex-1 p-2 flex flex-wrap items-center gap-1.5 overflow-x-auto">
        {tasks.length === 0 ? (
          <span className="text-xs text-[#6B7280] italic px-2 py-1">
            Glisse une tâche ici pour la journée entière
          </span>
        ) : (
          tasks.map((task) => {
            const style = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.General;

            return (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => onDragStartTask(e, task)}
                onClick={() => onSelectTask?.(task)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing",
                  style.bg,
                  style.text,
                  style.border,
                  task.isCompletedToday ? "opacity-60 line-through" : "hover:scale-[1.02]"
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(task.id);
                  }}
                  className="hover:scale-110 transition-transform cursor-pointer"
                >
                  {task.isCompletedToday ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D4F63D] fill-[#D4F63D]/20" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 opacity-60" />
                  )}
                </button>
                <span className="truncate max-w-[140px]">{task.title}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
