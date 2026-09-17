"use client";

import React, { useState } from "react";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
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
  ChevronDown,
  Copy,
  Moon,
  Tag,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects, useProjectMutations } from "@/features/projects/hooks";
import { getPriorityTitleClass, getPriorityIconColorClass } from "@/features/tasks/priority";
import confetti from "canvas-confetti";
import { isOvernightTimeRange } from "@/lib/dates";

interface AgendaTaskDetailModalProps {
  task: TaskWithCompletion | null;
  isOpen: boolean;
  selectedDate: string;
  onClose: () => void;
  onToggleComplete?: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onDuplicateTask?: (task: TaskWithCompletion) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTimes?: (taskId: string, startTime: string, endTime: string, date?: string) => void;
  onUpdateTask?: (taskId: string, values: Partial<TaskFormValues>) => void;
}

export const AgendaTaskDetailModal: React.FC<AgendaTaskDetailModalProps> = ({
  task,
  isOpen,
  selectedDate,
  onClose,
  onToggleComplete,
  onToggleReminder,
  onDuplicateTask,
  onEditTask,
  onDeleteTask,
  onUpdateTimes,
  onUpdateTask,
}) => {
  const { projects } = useProjects();
  const { updateProject } = useProjectMutations();
  const [title, setTitle] = useState(task?.title || "");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(task?.projectId || "");
  const [projectCategory, setProjectCategory] = useState<string>(task?.projectCategory || "");
  const [newSubprojectInput, setNewSubprojectInput] = useState("");
  const [startTime, setStartTime] = useState(task?.effectiveStartTime || task?.startTime || "09:00");
  const [endTime, setEndTime] = useState(task?.effectiveEndTime || task?.endTime || "10:00");
  const [isDone, setIsDone] = useState(Boolean(task?.isCompletedToday));
  const [isRemindersEnabled, setIsRemindersEnabled] = useState(Boolean(task?.enableReminders));

  const isDeletingRef = React.useRef(false);

  // Synchronize when task changes
  React.useEffect(() => {
    if (task) {
      isDeletingRef.current = false;
      setTitle(task.title || "");
      setSelectedProjectId(task.projectId || "");
      setProjectCategory(task.projectCategory || "");
      setStartTime(task.effectiveStartTime || task.startTime || "09:00");
      setEndTime(task.effectiveEndTime || task.endTime || "10:00");
      setIsDone(Boolean(task.isCompletedToday));
      setIsRemindersEnabled(Boolean(task.enableReminders));
      setNewSubprojectInput("");
    }
  }, [task, task?.isCompletedToday, task?.enableReminders, task?.projectCategory, task?.projectId]);

  if (!isOpen || !task) return null;

  const currentProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : task.projectId
    ? projects.find((p) => p.id === task.projectId)
    : null;

  const isRecurring = Boolean(task.recurrence && task.recurrence !== "ONCE");

  const handleToggleClick = () => {
    const nextDone = !isDone;
    setIsDone(nextDone);
    if (nextDone) {
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.7 },
        colors: [currentProject?.color || "#D4F63D", "#38BDF8", "#FFFFFF"],
      });
    }
    onToggleComplete?.(task.id);
  };

  const handleToggleReminderClick = () => {
    const nextReminders = !isRemindersEnabled;
    setIsRemindersEnabled(nextReminders);
    onToggleReminder?.(task.id);
  };

  const handleTitleBlur = () => {
    if (isDeletingRef.current) return;
    if (task && title.trim() && title.trim() !== task.title) {
      onUpdateTask?.(task.id, { title: title.trim() });
    }
  };

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDeletingRef.current = true;
    const currentTaskId = task.id;
    onClose();
    if (onDeleteTask && currentTaskId) {
      onDeleteTask(currentTaskId);
    }
  };

  const handleProjectChange = (newProjId: string) => {
    if (isDeletingRef.current) return;
    setSelectedProjectId(newProjId);
    setProjectCategory("");
    if (task) {
      onUpdateTask?.(task.id, { projectId: newProjId || null, projectCategory: null });
    }
  };

  const handleSelectSubproject = (cat: string) => {
    if (isDeletingRef.current) return;
    setProjectCategory(cat);
    if (task) {
      onUpdateTask?.(task.id, { projectCategory: cat || null });
    }
  };

  const handleAddNewSubproject = () => {
    const trimmed = newSubprojectInput.trim();
    if (!trimmed || !currentProject) return;
    handleSelectSubproject(trimmed);
    const currentCats = currentProject.categories || [];
    if (!currentCats.includes(trimmed)) {
      const nextCats = [...currentCats, trimmed];
      updateProject.mutate({
        projectId: currentProject.id,
        updates: { categories: nextCats },
      });
    }
    setNewSubprojectInput("");
  };

  const handleStartTimeChange = (newStart: string) => {
    if (isDeletingRef.current) return;
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

  const availableCategories = Array.from(
    new Set([...(currentProject?.categories || []), ...(projectCategory ? [projectCategory] : [])])
  );

  return (
    <div
      data-testid="agenda-task-detail-modal"
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
            {/* Project Selector Dropdown */}
            <div className="relative flex items-center">
              <select
                data-testid="agenda-detail-project-select"
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="appearance-none text-xs font-bold pl-7 pr-7 py-1.5 rounded-full border cursor-pointer focus:outline-none transition-all"
                style={{
                  backgroundColor: currentProject ? `${currentProject.color || "#D4F63D"}18` : "#20232C",
                  borderColor: currentProject ? `${currentProject.color || "#D4F63D"}50` : "#2D313E",
                  color: currentProject ? (currentProject.color || "#D4F63D") : "#94A3B8",
                }}
              >
                <option value="" className="bg-[#181A20] text-white">Sans projet</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#181A20] text-white">
                    {p.name}
                  </option>
                ))}
              </select>
              <span
                className="w-2.5 h-2.5 rounded-full absolute left-2.5 pointer-events-none shadow-sm"
                style={{ backgroundColor: currentProject?.color || "#94A3B8" }}
              />
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none opacity-60" />
            </div>

            {projectCategory && (
              <span className="text-[11px] text-[#A5B4FC] bg-[#818CF8]/15 border border-[#818CF8]/30 px-2 py-0.5 rounded-md font-semibold truncate flex items-center gap-1">
                <Tag className="w-3 h-3 text-[#818CF8]" />
                <span>{projectCategory}</span>
              </span>
            )}
          </div>

          <button
            data-testid="agenda-detail-close-btn"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#20232C] hover:bg-[#2B2F3D] flex items-center justify-center text-[#8E929E] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
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
                    "w-5 h-5 flex-shrink-0 mt-2",
                    getPriorityIconColorClass(task.priority)
                  )}
                />
              )}
              <div className="flex-1 min-w-0">
                <label className="text-[10px] uppercase font-bold text-[#8E929E] tracking-wider block mb-1">
                  Nom de la tâche
                </label>
                <input
                  data-testid="agenda-detail-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className={cn(
                    "w-full text-base sm:text-lg font-bold text-white bg-[#14161F] border border-[#2B2F40] hover:border-[#38BDF8]/60 focus:border-[#38BDF8] rounded-xl px-3 py-2 outline-none transition-all shadow-inner",
                    isDone && "line-through text-[#8E929E]"
                  )}
                  placeholder="Nom de la tâche..."
                />
              </div>
            </div>

            {task.description && (
              <p className="text-sm text-[#94A3B8] whitespace-pre-wrap pl-1 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Subproject / Category Section (if project is assigned) */}
          {currentProject && (
            <div className="p-3.5 rounded-2xl bg-[#1C1E28] border border-[#2B2F40] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#CBD5E1] font-semibold">
                  <Tag className="w-4 h-4 text-[#818CF8]" />
                  <span>Sous-projet / Catégorie</span>
                </div>
                {projectCategory && (
                  <button
                    type="button"
                    onClick={() => handleSelectSubproject("")}
                    className="text-[10px] font-semibold text-[#8E929E] hover:text-[#EF4444] transition-colors cursor-pointer"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Subproject Pills */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectSubproject("")}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                    !projectCategory
                      ? "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D] font-bold"
                      : "bg-[#14161F] border-[#2D3142] text-[#9CA3AF] hover:border-[#4B5563]"
                  )}
                >
                  Aucun
                </button>

                {availableCategories.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => handleSelectSubproject(cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                      projectCategory === cat
                        ? "bg-[#818CF8]/25 border-[#818CF8] text-[#C7D2FE] font-bold shadow-sm"
                        : "bg-[#14161F] border-[#2D3142] text-[#9CA3AF] hover:border-[#4B5563]"
                    )}
                  >
                    <Tag className="w-3 h-3 text-[#818CF8]" />
                    <span>{cat}</span>
                  </button>
                ))}
              </div>

              {/* Inline input to create new subproject */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Nouveau sous-projet..."
                  value={newSubprojectInput}
                  onChange={(e) => setNewSubprojectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNewSubproject();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#14161F] border border-[#2D3142] focus:border-[#818CF8] text-xs text-white outline-none placeholder-[#6B7280]"
                />
                <button
                  type="button"
                  onClick={handleAddNewSubproject}
                  disabled={!newSubprojectInput.trim()}
                  className="px-3 py-1.5 rounded-xl bg-[#818CF8]/20 hover:bg-[#818CF8]/30 text-[#818CF8] border border-[#818CF8]/40 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          )}

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
                  data-testid="agenda-detail-start-time-input"
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
                  data-testid="agenda-detail-end-time-input"
                  type="time"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full bg-[#14161F] border border-[#2D3142] hover:border-[#38BDF8] focus:border-[#38BDF8] rounded-xl px-3 py-2 text-white font-mono text-sm font-semibold focus:outline-none transition-colors"
                />
              </div>
            </div>

            {isOvernightTimeRange(startTime, endTime) && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-[#DDD6FE] text-xs font-medium animate-in fade-in duration-150">
                <Moon className="w-4 h-4 text-[#C4B5FD] flex-shrink-0" />
                <span>
                  Tâche à cheval sur 2 jours : visible le soir dès <strong>{startTime}</strong> et le lendemain matin jusqu'à <strong>{endTime}</strong>.
                </span>
              </div>
            )}

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
              data-testid="agenda-detail-toggle-complete-btn"
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
              data-testid="agenda-detail-toggle-reminder-btn"
              type="button"
              onClick={handleToggleReminderClick}
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

        {/* Footer: Full Edit, Duplicate & Delete */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#222430] bg-[#101117] flex-shrink-0 gap-2 flex-wrap">
          <button
            data-testid="agenda-detail-delete-btn"
            type="button"
            onPointerDown={() => {
              isDeletingRef.current = true;
            }}
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/15 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              data-testid="agenda-detail-duplicate-btn"
              type="button"
              onClick={() => {
                onClose();
                onDuplicateTask?.(task);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#20232C] hover:bg-[#2B2F3D] text-[#A5B4FC] hover:text-white transition-colors cursor-pointer border border-[#2D3142]"
              title="Créer une nouvelle occurrence aujourd'hui avec de nouveaux horaires sans écraser celle-ci"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Répéter aujourd'hui</span>
            </button>

            <button
              data-testid="agenda-detail-edit-btn"
              type="button"
              onClick={() => {
                onClose();
                onEditTask?.(task);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#D4F63D] text-black hover:bg-[#c2e430] transition-colors cursor-pointer shadow-sm"
            >
              <Edit3 className="w-4 h-4" />
              <span>Modifier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
