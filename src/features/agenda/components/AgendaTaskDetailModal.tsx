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

  // Synchronize when task changes
  React.useEffect(() => {
    if (task) {
      setStartTime(task.effectiveStartTime || task.startTime || "09:00");
      setEndTime(task.effectiveEndTime || task.endTime || "10:00");
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

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (onUpdateTimes && newStart && endTime) {
      onUpdateTimes(task.id, newStart, endTime, selectedDate);
    }
  };

  const handleEndTimeChange = (newEnd: string) => {
    setEndTime(newEnd);
    if (onUpdateTimes && startTime && newEnd) {
      onUpdateTimes(task.id, startTime, newEnd, selectedDate);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-[#14151C] border border-[#262836] shadow-2xl overflow-hidden text-white"
      >
        {/* Header: Project / Tag + Close */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222430] flex-shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            {project ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border truncate"
                style={{
                  backgroundColor: `${project.color || "#D4F63D"}15`,
                  borderColor: `${project.color || "#D4F63D"}40`,
                  color: project.color || "#D4F63D",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: project.color || "#D4F63D" }}
                />
                <span className="text-xs font-bold truncate">{project.name}</span>
              </div>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#20232C] text-[#94A3B8] border border-[#2D313E]">
                {task.tag || task.category || "Tâche"}
              </span>
            )}

            {task.projectCategory && (
              <span className="text-[11px] text-[#A5B4FC] bg-[#818CF8]/15 border border-[#818CF8]/30 px-2 py-0.5 rounded-md font-semibold truncate">
                {task.projectCategory}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#8E929E] hover:text-white hover:bg-[#20222B] transition-colors cursor-pointer flex-shrink-0"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
          {/* Title & Priority */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              {task.priority && task.priority !== "NORMAL" && (
                <Flame
                  className={cn(
                    "w-5 h-5 flex-shrink-0 mt-1",
                    getPriorityIconColorClass(task.priority)
                  )}
                />
              )}
              <h3
                className={cn(
                  "text-lg sm:text-xl font-extrabold text-white leading-snug break-words flex-1",
                  isDone && "line-through text-[#8E929E]"
                )}
              >
                {task.title}
              </h3>
            </div>

            {task.description && (
              <p className="text-sm text-[#94A3B8] whitespace-pre-wrap pl-0.5 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Date & Timing Section (Auto-saved directly on change) */}
          <div className="p-3.5 rounded-2xl bg-[#1C1E28] border border-[#2B2F40] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-[#CBD5E1] font-semibold">
                <Clock className="w-4 h-4 text-[#D4F63D]" />
                <span>Horaire</span>
              </div>
              <span className="text-[11px] text-[#8E929E]">Sauvegarde auto</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-[#8E929E] tracking-wider">Début</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full bg-[#14161F] border border-[#2D3142] hover:border-[#38BDF8] focus:border-[#38BDF8] rounded-xl px-3 py-2 text-white font-mono text-sm font-semibold focus:outline-none transition-colors"
                />
              </div>
              <span className="text-[#8E929E] text-xs pt-4 font-bold">à</span>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-[#8E929E] tracking-wider">Fin</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full bg-[#14161F] border border-[#2D3142] hover:border-[#38BDF8] focus:border-[#38BDF8] rounded-xl px-3 py-2 text-white font-mono text-sm font-semibold focus:outline-none transition-colors"
                />
              </div>
            </div>

            {isRecurring && (
              <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] pt-1.5 border-t border-white/5">
                <Repeat className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Tâche récurrente (modifie cet horaire)</span>
              </div>
            )}
          </div>

          {/* Quick Actions (Done & Reminders) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleToggleClick}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer shadow-sm",
                isDone
                  ? "bg-[#D4F63D]/15 border-[#D4F63D]/40 text-[#D4F63D] hover:bg-[#D4F63D]/25"
                  : "bg-[#1C1E28] border-[#2B2F40] text-white hover:border-[#D4F63D] hover:bg-[#232634]"
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

            <button
              type="button"
              onClick={() => onToggleReminder?.(task.id)}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer shadow-sm",
                isRemindersEnabled
                  ? "bg-[#38BDF8]/15 border-[#38BDF8]/40 text-[#38BDF8] hover:bg-[#38BDF8]/25"
                  : "bg-[#1C1E28] border-[#2B2F40] text-[#8E929E] hover:text-white hover:bg-[#232634]"
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
        </div>

        {/* Footer: Full Edit & Delete */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#222430] bg-[#101117] flex-shrink-0 gap-3">
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#D4F63D] text-black hover:bg-[#c2e430] transition-colors cursor-pointer shadow-sm"
          >
            <Edit3 className="w-4 h-4" />
            <span>Modifier la tâche</span>
          </button>
        </div>
      </div>
    </div>
  );
};
