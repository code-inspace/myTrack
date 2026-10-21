"use client";

import React, { useState } from "react";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import {
  X,
  CheckCircle2,
  Circle,
  Clock,
  Bell,
  BellOff,
  Edit3,
  Trash2,
  Repeat,
  ChevronDown,
  Copy,
  Moon,
  Tag,
  Check,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects, useProjectMutations } from "@/features/projects/hooks";
import { PriorityBadge } from "@/features/tasks/components/PriorityBadge";
import confetti from "canvas-confetti";
import { isOvernightTimeRange } from "@/lib/dates";
import {
  isSleepTitle,
  isNapTitle,
  extractTimesFromTitle,
  syncTaskWithSleepLog,
} from "@/features/sleep/actions";

interface AgendaTaskDetailModalProps {
  task: TaskWithCompletion | null;
  isOpen: boolean;
  selectedDate: string;
  onClose: () => void;
  onToggleComplete?: (taskId: string, date?: string) => void;
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const isDeletingRef = React.useRef(false);
  const activeTaskIdRef = React.useRef<string | null>(null);

  // Fill the form only when the modal opens. While it stays open, the same task can be replaced
  // (optimistic "temp-…" id → server id after a creation, or a sync/realtime refresh): resetting
  // then would wipe what the user is typing. Only the done state follows the live task.
  React.useEffect(() => {
    if (!isOpen || !task) {
      activeTaskIdRef.current = null;
      return;
    }

    if (activeTaskIdRef.current === null) {
      activeTaskIdRef.current = task.id;
      isDeletingRef.current = false;

      const initTitle = task.title || "";
      const initProj = task.projectId || "";
      const initCat = task.projectCategory || "";
      const initStart = task.effectiveStartTime || task.startTime || "09:00";
      const initEnd = task.effectiveEndTime || task.endTime || "10:00";
      const initReminders = Boolean(task.enableReminders);

      setTitle(initTitle);
      setSelectedProjectId(initProj);
      setProjectCategory(initCat);
      setStartTime(initStart);
      setEndTime(initEnd);
      setIsDone(Boolean(task.isCompletedToday));
      setIsRemindersEnabled(initReminders);
      setNewSubprojectInput("");
      setSaveStatus("idle");
    } else {
      activeTaskIdRef.current = task.id;
      setIsDone(Boolean(task.isCompletedToday));
    }
  }, [isOpen, task?.id, task?.isCompletedToday]);

  // Cancel action: Discards all changes without saving
  const handleCancel = React.useCallback(() => {
    onClose();
  }, [onClose]);

  // Validate & Save action: Saves all changes atomically in ONE single update
  const handleSaveAndClose = React.useCallback(() => {
    if (!task || isDeletingRef.current) {
      onClose();
      return;
    }

    const trimmedTitle = title.trim();
    const effectiveTitle = trimmedTitle || task.title;
    const isSleep = isSleepTitle(effectiveTitle);
    const isNap = isNapTitle(effectiveTitle);

    const initTitle = task.title || "";
    const initProj = task.projectId || "";
    const initCat = task.projectCategory || "";
    const initStart = task.effectiveStartTime || task.startTime || "09:00";
    const initEnd = task.effectiveEndTime || task.endTime || "10:00";
    const initReminders = Boolean(task.enableReminders);

    const hasTitleChanged = trimmedTitle !== "" && trimmedTitle !== initTitle;
    const hasProjectChanged = selectedProjectId !== initProj;
    const hasCategoryChanged = projectCategory !== initCat;
    const hasStartTimeChanged = startTime !== initStart;
    const hasEndTimeChanged = endTime !== initEnd;
    const hasRemindersChanged = isRemindersEnabled !== initReminders;

    if (
      hasTitleChanged ||
      hasProjectChanged ||
      hasCategoryChanged ||
      hasStartTimeChanged ||
      hasEndTimeChanged ||
      hasRemindersChanged
    ) {
      const updates: Partial<TaskFormValues> = {
        date: selectedDate,
      };

      if (hasTitleChanged) updates.title = effectiveTitle;
      if (hasProjectChanged) {
        updates.projectId = selectedProjectId || null;
        updates.isNoProject = !selectedProjectId;
      }
      if (hasCategoryChanged || hasProjectChanged) {
        updates.projectCategory = projectCategory || null;
      }
      if (hasStartTimeChanged) updates.startTime = startTime;
      if (hasEndTimeChanged) updates.endTime = endTime;
      if (hasRemindersChanged) updates.enableReminders = isRemindersEnabled;

      if (isSleep || isNap) {
        updates.category = "Santé";
        updates.tag = "Santé";
        updates.trackingType = "DURATION";
        updates.targetValue = task.targetValue || (isNap ? 30 : 480);
        const parsed = extractTimesFromTitle(effectiveTitle);
        if (parsed.cleanTitle && parsed.cleanTitle !== effectiveTitle) {
          updates.title = parsed.cleanTitle;
        }
        if (parsed.startTime) updates.startTime = parsed.startTime;
        if (parsed.endTime) updates.endTime = parsed.endTime;
      }

      onUpdateTask?.(task.id, updates);

      if (isSleep || isNap) {
        syncTaskWithSleepLog(
          {
            ...task,
            title: updates.title || effectiveTitle,
            startTime: updates.startTime || startTime,
            endTime: updates.endTime || endTime,
            trackingType: "DURATION",
            targetValue: updates.targetValue || task.targetValue || (isNap ? 30 : 480),
          },
          selectedDate
        ).catch((e) => console.warn("syncTaskWithSleepLog error:", e));
      }
    }

    onClose();
  }, [
    task,
    title,
    selectedProjectId,
    projectCategory,
    startTime,
    endTime,
    isRemindersEnabled,
    selectedDate,
    onUpdateTask,
    onClose,
  ]);

  // Handle Escape key to cancel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel]);

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
    // A recurring task is completed for the day it's shown on (its "date" is just its start date)
    onToggleComplete?.(task.id, isRecurring ? selectedDate : (task as any).date || selectedDate);
  };

  const handleToggleReminderClick = () => {
    setIsRemindersEnabled(!isRemindersEnabled);
  };

  const handleTitleChange = (newVal: string) => {
    setTitle(newVal);
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
  };

  const handleSelectSubproject = (cat: string) => {
    if (isDeletingRef.current) return;
    setProjectCategory(cat);
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
  };

  const handleEndTimeChange = (newEnd: string) => {
    if (isDeletingRef.current) return;
    setEndTime(newEnd);
  };

  const availableCategories = Array.from(
    new Set([...(currentProject?.categories || []), ...(projectCategory ? [projectCategory] : [])])
  );

  return (
    <div
      data-testid="agenda-task-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-[#14151C] border border-[#262836] shadow-2xl overflow-hidden text-white modal-adaptive-card"
      >
        {/* iOS-Style Header: Annuler (Top Left) | Project / Titre (Center) | Valider (Top Right) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#222430] flex-shrink-0 gap-3">
          {/* Top-Left: Annuler / Cross Button */}
          <button
            data-testid="agenda-detail-cancel-btn"
            type="button"
            onClick={handleCancel}
            title="Annuler les modifications"
            className="w-9 h-9 rounded-full bg-[#242630] text-[#E2E8F0] hover:text-white hover:bg-[#323644] flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Top-Center: Project Selector & Subproject Badge */}
          <div className="flex items-center justify-center gap-2 min-w-0 flex-1">
            {/* Project Selector Dropdown */}
            <div className="relative flex items-center max-w-[180px] sm:max-w-[220px]">
              <select
                data-testid="agenda-detail-project-select"
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="appearance-none text-xs font-bold pl-7 pr-7 py-1.5 rounded-full border cursor-pointer focus:outline-none transition-all truncate w-full"
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
                className="w-2.5 h-2.5 rounded-full absolute left-2.5 pointer-events-none shadow-sm shrink-0"
                style={{ backgroundColor: currentProject?.color || "#94A3B8" }}
              />
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none opacity-60 shrink-0" />
            </div>

            {projectCategory && (
              <span className="hidden sm:flex text-[11px] text-[#A5B4FC] bg-[#818CF8]/15 border border-[#818CF8]/30 px-2 py-0.5 rounded-md font-semibold truncate items-center gap-1 shrink-0">
                <Tag className="w-3 h-3 text-[#818CF8]" />
                <span>{projectCategory}</span>
              </span>
            )}
          </div>

          {/* Top-Right: Valider / Check Button (iOS Style Accent) */}
          <button
            data-testid="agenda-detail-save-btn"
            type="button"
            onClick={handleSaveAndClose}
            title="Valider et enregistrer"
            className="w-9 h-9 rounded-full bg-[#FF453A] sm:bg-[#D4F63D] text-white sm:text-black font-extrabold flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0"
          >
            <Check className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 min-w-0 max-w-full break-words [overflow-wrap:anywhere] overscroll-contain pb-10">
          {/* Title & Priority */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              {task.priority && task.priority !== "NORMAL" && (
                <PriorityBadge priority={task.priority} size="md" className="mt-6 text-white" />
              )}
              <div className="flex-1 min-w-0">
                <label className="text-[10px] uppercase font-bold text-[#8E929E] tracking-wider block mb-1">
                  Nom de la tâche
                </label>
                <input
                  data-testid="agenda-detail-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
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
                {(isSleepTitle(title) || isNapTitle(title)) && (
                  <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-[#D8B4FE] text-xs font-semibold animate-in fade-in duration-150">
                    <Moon className="w-3.5 h-3.5 text-[#C4B5FD] fill-current flex-shrink-0" />
                    <span>Traité automatiquement comme un journal de sommeil</span>
                  </div>
                )}
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
              <div className="flex items-center gap-1.5">
                {saveStatus === "saving" && (
                  <span className="text-[11px] text-[#38BDF8] flex items-center gap-1 animate-pulse font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Enregistrement...</span>
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-[11px] text-[#D4F63D] flex items-center gap-1 font-medium animate-in fade-in duration-150">
                    <Check className="w-3 h-3 text-[#D4F63D]" />
                    <span>Enregistré</span>
                  </span>
                )}
                {saveStatus === "idle" && (
                  <span className="text-[11px] text-[#8E929E]">Sauvegarde auto</span>
                )}
              </div>
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
              title="Dupliquer cette tâche"
            >
              <Copy className="w-4 h-4" />
              <span>Dupliquer</span>
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
