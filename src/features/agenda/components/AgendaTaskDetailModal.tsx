"use client";

import React, { useState } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import {
  X,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Bell,
  BellOff,
  Edit3,
  Trash2,
  Flame,
  Repeat,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/features/projects/hooks";
import { getPriorityTitleClass, getPriorityIconColorClass } from "@/features/tasks/priority";
import confetti from "canvas-confetti";

interface AgendaTaskDetailModalProps {
  task: TaskWithCompletion | null;
  isOpen: boolean;
  selectedDate: string;
  onClose: () => void;
  onToggleComplete?: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTimes?: (taskId: string, startTime: string, endTime: string, date?: string) => void;
}

export const AgendaTaskDetailModal: React.FC<AgendaTaskDetailModalProps> = ({
  task,
  isOpen,
  selectedDate,
  onClose,
  onToggleComplete,
  onToggleReminder,
  onEditTask,
  onDeleteTask,
  onUpdateTimes,
}) => {
  const { projects } = useProjects();
  const [startTime, setStartTime] = useState(task?.effectiveStartTime || task?.startTime || "09:00");
  const [endTime, setEndTime] = useState(task?.effectiveEndTime || task?.endTime || "10:00");
  const [isEditingTimes, setIsEditingTimes] = useState(false);

  // Synchronize when task changes
  React.useEffect(() => {
    if (task) {
      setStartTime(task.effectiveStartTime || task.startTime || "09:00");
      setEndTime(task.effectiveEndTime || task.endTime || "10:00");
      setIsEditingTimes(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const isDone = Boolean(task.isCompletedToday);
  const isRemindersEnabled = task.enableReminders !== false;
  const isRecurring = Boolean(task.recurrence && task.recurrence !== "ONCE");

  const handleToggleClick = () => {
    if (!isDone) {
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.7 },
        colors: [project?.color || "#D4F63D", "#38BDF8", "#FFFFFF"],
      });
    }
    onToggleComplete?.(task.id);
  };

  const handleSaveTimes = () => {
    if (onUpdateTimes && startTime && endTime) {
      onUpdateTimes(task.id, startTime, endTime, selectedDate);
    }
    setIsEditingTimes(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#16181F] border border-[#272A35] rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl overflow-hidden flex flex-col gap-4 animate-in slide-in-from-bottom duration-250 max-h-[90vh] overflow-y-auto"
      >
        {/* Header: Project / Tag + Close */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {project && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border truncate"
                style={{
                  backgroundColor: `${project.color || "#D4F63D"}18`,
                  borderColor: `${project.color || "#D4F63D"}40`,
                  color: project.color || "#D4F63D",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: project.color || "#D4F63D" }}
                />
                <span className="truncate">{project.name}</span>
              </span>
            )}
            {task.projectCategory && (
              <span className="text-[11px] text-[#A5B4FC] bg-[#818CF8]/15 border border-[#818CF8]/30 px-2 py-0.5 rounded-md font-semibold truncate">
                {task.projectCategory}
              </span>
            )}
            {(task.tag || task.category) && !project && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#20232C] text-[#94A3B8] border border-[#2D313E]">
                {task.tag || task.category}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8E929E] hover:text-white hover:bg-[#222530] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Priority */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            {task.priority && task.priority !== "NORMAL" && (
              <Flame
                className={cn(
                  "w-5 h-5 flex-shrink-0 mt-0.5",
                  getPriorityIconColorClass(task.priority)
                )}
              />
            )}
            <h3
              className={cn(
                "text-lg font-bold text-white leading-snug break-words flex-1",
                isDone && "line-through text-[#8E929E]"
              )}
            >
              {task.title}
            </h3>
          </div>

          {task.description && (
            <p className="text-sm text-[#94A3B8] whitespace-pre-wrap mt-1">
              {task.description}
            </p>
          )}
        </div>

        {/* Timing Section (Apple Calendar style) */}
        <div className="bg-[#1C1F28] border border-[#2B2F3D] rounded-xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#CBD5E1] font-medium">
              <Clock className="w-4 h-4 text-[#D4F63D]" />
              <span>Horaire</span>
            </div>
            {!isEditingTimes ? (
              <button
                type="button"
                onClick={() => setIsEditingTimes(true)}
                className="text-xs text-[#38BDF8] hover:underline font-semibold cursor-pointer"
              >
                Modifier
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveTimes}
                className="text-xs text-[#D4F63D] hover:underline font-bold cursor-pointer"
              >
                Appliquer
              </button>
            )}
          </div>

          {!isEditingTimes ? (
            <div className="flex items-center gap-2 text-white font-mono text-sm font-semibold">
              <span className="px-2.5 py-1 rounded-lg bg-[#14161C] border border-[#2D313E]">
                {startTime}
              </span>
              <span className="text-[#8E929E]">à</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#14161C] border border-[#2D313E]">
                {endTime || "..."}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 bg-[#14161C] border border-[#38BDF8] rounded-lg px-2.5 py-1.5 text-white font-mono text-sm font-semibold focus:outline-none"
              />
              <span className="text-[#8E929E] text-xs">à</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 bg-[#14161C] border border-[#38BDF8] rounded-lg px-2.5 py-1.5 text-white font-mono text-sm font-semibold focus:outline-none"
              />
            </div>
          )}

          {isRecurring && (
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] pt-1 border-t border-white/5">
              <Repeat className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Tâche récurrente</span>
            </div>
          )}
        </div>

        {/* Completion & Reminder Quick Toggle Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Complete button */}
          <button
            type="button"
            onClick={handleToggleClick}
            className={cn(
              "flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer shadow-sm",
              isDone
                ? "bg-[#D4F63D]/15 border-[#D4F63D]/40 text-[#D4F63D] hover:bg-[#D4F63D]/25"
                : "bg-[#1F232D] border-[#2D313F] text-white hover:border-[#D4F63D] hover:bg-[#252A36]"
            )}
          >
            {isDone ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#D4F63D]" />
                <span>Terminé</span>
              </>
            ) : (
              <>
                <Circle className="w-4 h-4 text-[#8E929E]" />
                <span>Marquer fait</span>
              </>
            )}
          </button>

          {/* Reminder button */}
          <button
            type="button"
            onClick={() => onToggleReminder?.(task.id)}
            className={cn(
              "flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer shadow-sm",
              isRemindersEnabled
                ? "bg-[#38BDF8]/15 border-[#38BDF8]/40 text-[#38BDF8] hover:bg-[#38BDF8]/25"
                : "bg-[#1F232D] border-[#2D313F] text-[#8E929E] hover:text-white hover:bg-[#252A36]"
            )}
          >
            {isRemindersEnabled ? (
              <>
                <Bell className="w-4 h-4 text-[#38BDF8] fill-[#38BDF8]/30" />
                <span>Rappels On</span>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 text-[#8E929E]" />
                <span>Rappels Off</span>
              </>
            )}
          </button>
        </div>

        {/* Bottom Actions: Full Edit / Delete */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#232632]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDeleteTask?.(task.id);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/15 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEditTask?.(task);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#D4F63D] text-black hover:bg-[#c2e430] transition-colors cursor-pointer shadow-sm"
          >
            <Edit3 className="w-4 h-4" />
            <span>Modifier la tâche</span>
          </button>
        </div>
      </div>
    </div>
  );
};
