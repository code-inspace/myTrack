"use client";

import React, { useState, useMemo } from "react";
import { Task, TaskWithCompletion } from "@/features/tasks/types";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { ExternalEventTaskCard } from "@/features/calendar/components/ExternalEventTaskCard";
import { getExternalEventStatus, isExternalEventDone, isExternalEventInProgress } from "@/features/calendar/lib/status";
import { TaskCard } from "../TaskCard";
import { ActiveTaskBanner } from "../ActiveTaskBanner";
import { TaskCardSkeleton } from "../TaskCardSkeleton";
import {
  buildAndSortUnifiedStream,
  UnifiedStreamItem,
  getStoredStreamOrder,
  saveStoredStreamOrder,
} from "@/features/tasks/unifiedStream";
import { DesktopWidgetsPane } from "./DesktopWidgetsPane";
import { DesktopDatePicker } from "./DesktopDatePicker";
import { TaskAutoCompleteSuggestions } from "../TaskAutoCompleteSuggestions";
import { useProjects } from "@/features/projects/hooks";
import { CheckCircle2, Plus, Flame, Inbox, Calendar, RefreshCw, Play } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

type FilterStatus = "all" | "active" | "urgent" | "todo" | "done";

interface DesktopTasksViewProps {
  tasks: TaskWithCompletion[];
  allTasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  searchQuery: string;
  onNewTask: () => void;
  onEditTask: (task: TaskWithCompletion | Task) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleActive: (taskId: string) => void;
  onStopTask?: (taskId: string) => void;
  onToggleReminder: (taskId: string) => void;
  onOpenLogModal: (task: TaskWithCompletion) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks: (taskIds: string[]) => void;
  onUpdateTaskStartedAt: (taskId: string, newTime: string) => void;
  onSelectExternalEvent?: (event: ExternalCalendarEvent) => void;
  quickTitle: string;
  onQuickTitleChange: (title: string) => void;
  onQuickAdd: (e: React.FormEvent) => void;
  onQuickAddAndStart?: () => void;
  onSelectSuggestion?: (task: Task, autoStart?: boolean) => void;
  onSelectTab?: (tab: any) => void;
  sleepDurationText?: string;
  isInitialLoading?: boolean;
  isSyncing?: boolean;
  showCompleted?: boolean;
  onToggleShowCompleted?: () => void;
}

export const DesktopTasksView: React.FC<DesktopTasksViewProps> = ({
  tasks,
  allTasks,
  externalEvents = [],
  selectedDate,
  onSelectDate,
  searchQuery,
  onNewTask,
  onEditTask,
  onToggleComplete,
  onToggleActive,
  onStopTask,
  onToggleReminder,
  onOpenLogModal,
  onDeleteTask,
  onReorderTasks,
  onUpdateTaskStartedAt,
  onSelectExternalEvent,
  quickTitle,
  onQuickTitleChange,
  onQuickAdd,
  onQuickAddAndStart,
  onSelectSuggestion,
  onSelectTab,
  sleepDurationText,
  isInitialLoading = false,
  isSyncing = false,
  showCompleted,
  onToggleShowCompleted,
}) => {
  const queryClient = useQueryClient();
  const { projects } = useProjects();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [manualCompletedEvents, setManualCompletedEvents] = useState<Record<string, boolean>>({});
  const [isAutoCompleteOpen, setIsAutoCompleteOpen] = useState(false);
  const [autoCompleteIndex, setAutoCompleteIndex] = useState(-1);
  const [showCalendar, setShowCalendar] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mytrack_show_calendar_in_tasks") !== "false";
    }
    return true;
  });

  const [localShowCompleted, setLocalShowCompleted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mytrack_show_completed_in_tasks") !== "false";
    }
    return true;
  });

  const isShowCompleted = showCompleted !== undefined ? showCompleted : localShowCompleted;
  const toggleShowCompleted = () => {
    if (onToggleShowCompleted) {
      onToggleShowCompleted();
    } else {
      setLocalShowCompleted((prev) => {
        const next = !prev;
        if (typeof window !== "undefined") {
          localStorage.setItem("mytrack_show_completed_in_tasks", String(next));
        }
        return next;
      });
    }
  };

  const matchingTasks = useMemo(() => {
    const cleanQuery = quickTitle.trim().toLowerCase();
    if (!cleanQuery) return [];
    const taskMap = new Map<string, Task>();
    for (const t of allTasks) {
      if (!t.title) continue;
      const titleClean = t.title.trim().toLowerCase();
      if (titleClean.includes(cleanQuery)) {
        if (!taskMap.has(titleClean)) {
          taskMap.set(titleClean, t);
        }
      }
    }
    return Array.from(taskMap.values()).slice(0, 5);
  }, [allTasks, quickTitle]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const toggleCalendarVisibility = () => {
    setShowCalendar((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("mytrack_show_calendar_in_tasks", String(next));
      }
      return next;
    });
  };

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeTasks = tasks.filter((t) => t.isActive);
  const activeTask = activeTasks[0] || null;

  // ONLY include external events for the EXACT viewed date!
  const dayExternalEvents = useMemo(() => {
    if (!showCalendar) return [];
    return externalEvents.filter((e) => e.date === selectedDate);
  }, [externalEvents, selectedDate, showCalendar]);

  const toggleEventCompleted = (eventId: string) => {
    setManualCompletedEvents((prev) => {
      const current = prev[eventId];
      const defaultDone = dayExternalEvents.find((e) => e.id === eventId)
        ? isExternalEventDone(dayExternalEvents.find((e) => e.id === eventId)!, selectedDate)
        : false;
      const nextVal = current !== undefined ? !current : !defaultDone;
      return { ...prev, [eventId]: nextVal };
    });
  };

  // Counts for pills (tasks + external calendar events of the selected date)
  const counts = useMemo(() => {
    const activeEventsCount = dayExternalEvents.filter(
      (e) => getExternalEventStatus(e, selectedDate, manualCompletedEvents[e.id]) === "IN_PROGRESS"
    ).length;
    const todoEventsCount = dayExternalEvents.filter(
      (e) => getExternalEventStatus(e, selectedDate, manualCompletedEvents[e.id]) === "TODO"
    ).length;
    const doneEventsCount = dayExternalEvents.filter(
      (e) => getExternalEventStatus(e, selectedDate, manualCompletedEvents[e.id]) === "DONE"
    ).length;

    return {
      all: tasks.length + dayExternalEvents.length,
      active: tasks.filter((t) => t.isActive).length + activeEventsCount,
      urgent: tasks.filter((t) => t.priority && t.priority !== "NORMAL" && !t.isCompletedToday).length,
      todo: tasks.filter((t) => !t.isCompletedToday).length + todoEventsCount,
      done: tasks.filter((t) => t.isCompletedToday).length + doneEventsCount,
    };
  }, [tasks, dayExternalEvents, selectedDate, manualCompletedEvents]);

  // Filtered external events strictly for the selected date
  const filteredExternalEvents = useMemo(() => {
    if (!showCalendar) return [];
    return dayExternalEvents.filter((event) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = event.title.toLowerCase().includes(q);
        const matchesCal = event.calendarName.toLowerCase().includes(q);
        const matchesLoc = event.location?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCal && !matchesLoc) return false;
      }

      // 2. Category Filter (Category filter only applies if "Calendar" or empty)
      if (categoryFilter && categoryFilter !== "Calendar" && categoryFilter !== "General") {
        return false;
      }

      // 3. Status Pill
      const status = getExternalEventStatus(event, selectedDate, manualCompletedEvents[event.id]);
      if (statusFilter === "active") return status === "IN_PROGRESS";
      if (statusFilter === "urgent") return false;
      if (statusFilter === "todo") return status === "TODO";
      if (statusFilter === "done") return status === "DONE";

      return true;
    });
  }, [dayExternalEvents, searchQuery, categoryFilter, statusFilter, selectedDate, manualCompletedEvents, showCalendar]);

  // Filtered tasks according to search, status pill, category
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesCat = task.category?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat) return false;
      }

      // 2. Category Filter
      if (categoryFilter && task.category !== categoryFilter) {
        return false;
      }

      // 3. Status Pill
      if (statusFilter === "active") return task.isActive;
      if (statusFilter === "urgent") return task.priority && task.priority !== "NORMAL" && !task.isCompletedToday;
      if (statusFilter === "todo") return !task.isCompletedToday;
      if (statusFilter === "done") return task.isCompletedToday;

      return true;
    });
  }, [tasks, searchQuery, categoryFilter, statusFilter]);

  const orderedTasks = filteredTasks.filter((t) => !t.isActive);

  const [streamOrder, setStreamOrder] = useState<string[]>(() => {
    return getStoredStreamOrder(selectedDate);
  });

  React.useEffect(() => {
    setStreamOrder(getStoredStreamOrder(selectedDate));
  }, [selectedDate]);

  const unifiedStream = useMemo(() => {
    return buildAndSortUnifiedStream(
      filteredTasks,
      filteredExternalEvents,
      selectedDate,
      manualCompletedEvents,
      showCalendar,
      streamOrder,
      statusFilter === "done" ? true : isShowCompleted
    );
  }, [filteredTasks, filteredExternalEvents, selectedDate, manualCompletedEvents, showCalendar, streamOrder, isShowCompleted, statusFilter]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = unifiedStream.findIndex((item) => item.id === active.id);
    const newIndex = unifiedStream.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(unifiedStream, oldIndex, newIndex);
    const newOrderedIds = reordered.map((item) => item.id);
    setStreamOrder(newOrderedIds);
    saveStoredStreamOrder(selectedDate, newOrderedIds);

    const taskIds = reordered
      .filter((item): item is { type: "task"; id: string; data: TaskWithCompletion } => item.type === "task")
      .map((item) => item.data.id);

    if (taskIds.length > 0) {
      onReorderTasks(taskIds);
    }
  };

  const formattedDate = useMemo(() => {
    try {
      const d = parseISO(selectedDate);
      return format(d, "EEEE d MMMM yyyy", { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-6 overflow-hidden">
      {/* 1. Header Section: Title, Subtitle, & Actions */}
      <div className="flex items-center justify-between gap-4 pb-3 select-none flex-shrink-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Ma Journée</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#D4F63D]/15 text-[#D4F63D] border border-[#D4F63D]/30 text-xs font-mono font-bold">
              Temps réel
            </span>
          </h1>
          <p className="text-xs text-[#8E929E] mt-0.5 capitalize">{formattedDate}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Force Sync button */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Rafraîchir et synchroniser les données"
            className="p-2.5 rounded-2xl bg-[#17181F] border border-[#282B36] hover:border-[#3D4252] text-[#8E929E] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-[#D4F63D]")} />
          </button>

          {/* New Task button */}
          <button
            type="button"
            onClick={onNewTask}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-bold text-xs shadow-lg shadow-[#D4F63D]/15 transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nouvelle tâche</span>
          </button>
        </div>
      </div>

      {/* 2. Desktop Date Picker — restored in dedicated row */}
      <div className="pb-3 flex-shrink-0">
        <DesktopDatePicker
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      </div>

      {/* 3. Filter Pills Bar (Inspired by the Reference screenshot's pill filters) */}
      <div className="flex items-center gap-2 pb-4 overflow-x-auto scrollbar-none select-none">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "all"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <span>Toutes</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "all" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "active"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <span>En cours</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "active" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.active}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("urgent")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "urgent"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <Flame className="w-3 h-3 text-[#F97316]" />
          <span>Prioritaires</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "urgent" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.urgent}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("todo")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "todo"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <span>À faire</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "todo" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.todo}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("done")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "done"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <CheckCircle2 className="w-3 h-3 text-[#D4F63D]" />
          <span>Terminées</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "done" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.done}
          </span>
        </button>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {/* Completed tasks visibility toggle button */}
          <button
            type="button"
            onClick={toggleShowCompleted}
            title={isShowCompleted ? "Masquer les tâches déjà faites" : "Afficher les tâches déjà faites"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border",
              isShowCompleted
                ? "bg-[#D4F63D]/15 border-[#D4F63D]/40 text-[#D4F63D]"
                : "bg-[#181920] border-[#282A34] text-[#6B7280] hover:text-[#9CA3AF]"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Faites {isShowCompleted ? "ON" : "OFF"}</span>
          </button>

          {/* Calendar visibility toggle button */}
          <button
            type="button"
            onClick={toggleCalendarVisibility}
            title={showCalendar ? "Masquer les événements d'agenda externe" : "Afficher les événements d'agenda externe"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border",
              showCalendar
                ? "bg-[#3B82F6]/15 border-[#3B82F6]/40 text-[#60A5FA]"
                : "bg-[#181920] border-[#282A34] text-[#6B7280] hover:text-[#9CA3AF]"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Agenda {showCalendar ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* 3. Main Two-Column Layout (Left: Task Stream, Right: Intelligence Widgets) */}
      <div className="flex-1 min-h-0 flex items-start gap-6">
        {/* Left Pane: Tasks Workspace */}
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-y-auto scrollbar-none pr-2 space-y-4">
          {/* Quick Task Input Bar */}
          <form
            onSubmit={(e) => {
              if (autoCompleteIndex >= 0 && autoCompleteIndex < matchingTasks.length) {
                e.preventDefault();
                onSelectSuggestion?.(matchingTasks[autoCompleteIndex], false);
                setIsAutoCompleteOpen(false);
                setAutoCompleteIndex(-1);
                return;
              }
              onQuickAdd(e);
              setIsAutoCompleteOpen(false);
              setAutoCompleteIndex(-1);
            }}
            className="w-full relative select-none"
          >
            <div className="relative flex items-center">
              <div className="absolute left-4 text-[#D4F63D]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Ajouter rapidement une tâche et appuyer sur Entrée..."
                value={quickTitle}
                onFocus={() => {
                  if (quickTitle.trim()) setIsAutoCompleteOpen(true);
                }}
                onChange={(e) => {
                  onQuickTitleChange(e.target.value);
                  setIsAutoCompleteOpen(true);
                  setAutoCompleteIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (!isAutoCompleteOpen || matchingTasks.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setAutoCompleteIndex((prev) => (prev + 1) % matchingTasks.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setAutoCompleteIndex((prev) => (prev - 1 + matchingTasks.length) % matchingTasks.length);
                  } else if (e.key === "Escape") {
                    setIsAutoCompleteOpen(false);
                    setAutoCompleteIndex(-1);
                  }
                }}
                className={cn(
                  "w-full pl-11 py-3.5 rounded-2xl bg-[#17181F] border border-[#282B36] text-sm text-white focus:border-[#D4F63D] outline-none placeholder-[#6B7280] shadow-sm transition-all",
                  quickTitle.trim() ? "pr-48" : "pr-24"
                )}
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                {quickTitle.trim() && onQuickAddAndStart && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (autoCompleteIndex >= 0 && autoCompleteIndex < matchingTasks.length) {
                        onSelectSuggestion?.(matchingTasks[autoCompleteIndex], true);
                        setIsAutoCompleteOpen(false);
                        setAutoCompleteIndex(-1);
                        return;
                      }
                      onQuickAddAndStart();
                      setIsAutoCompleteOpen(false);
                      setAutoCompleteIndex(-1);
                    }}
                    title="Créer et démarrer immédiatement"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Démarrer</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!quickTitle.trim()}
                  className="px-3 py-1.5 rounded-xl bg-[#252830] border border-[#383C48] text-[#E5E7EB] font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#343740] transition-all cursor-pointer"
                >
                  Ajouter
                </button>
              </div>
            </div>

            {/* Auto-completion suggestions dropdown */}
            <TaskAutoCompleteSuggestions
              query={quickTitle}
              allTasks={allTasks}
              projects={projects}
              isOpen={isAutoCompleteOpen}
              selectedIndex={autoCompleteIndex}
              setSelectedIndex={setAutoCompleteIndex}
              onClose={() => setIsAutoCompleteOpen(false)}
              onSelectSuggestion={(task, autoStart) => {
                onSelectSuggestion?.(task, autoStart);
                setIsAutoCompleteOpen(false);
                setAutoCompleteIndex(-1);
              }}
            />
          </form>

          {/* Active Running Task Banners if any */}
          {activeTasks.length > 0 && (
            <div className="space-y-3">
              {activeTasks.map((actTask) => (
                <ActiveTaskBanner
                  key={actTask.id}
                  task={actTask}
                  onStop={(taskId) => (onStopTask ? onStopTask(taskId) : onToggleActive(taskId))}
                  onComplete={(taskId) => onToggleComplete(taskId)}
                  onOpenLogModal={(t) => onOpenLogModal(t)}
                  onUpdateStartTime={(taskId, newTime) =>
                    onUpdateTaskStartedAt(taskId, newTime)
                  }
                />
              ))}
            </div>
          )}

          {/* Unified Tasks & External Calendar Events Stream */}
          <div className="space-y-3 pb-16">
            {isInitialLoading && unifiedStream.length === 0 && activeTasks.length === 0 ? (
              <TaskCardSkeleton count={4} />
            ) : unifiedStream.length === 0 && activeTasks.length === 0 ? (
              <div className="p-12 text-center bg-[#15161B] border border-[#242630] rounded-3xl my-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#20222B] border border-[#2E313D] flex items-center justify-center text-[#8E929E] mx-auto">
                  <Inbox className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Aucun élément trouvé</h4>
                  <p className="text-xs text-[#8E929E] mt-1">
                    {searchQuery
                      ? "Aucun résultat pour cette recherche."
                      : "Aucune tâche ni événement pour les filtres sélectionnés."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onNewTask}
                  className="px-4 py-2 rounded-2xl bg-[#D4F63D] text-black font-bold text-xs cursor-pointer shadow-lg shadow-[#D4F63D]/20 transition-all hover:scale-105"
                >
                  Créer une tâche
                </button>
              </div>
            ) : (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={unifiedStream.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2.5">
                    {unifiedStream.map((item) =>
                      item.type === "task" ? (
                        <TaskCard
                          key={item.id}
                          task={item.data}
                          sortable
                          onToggleActive={onToggleActive}
                          onToggleComplete={onToggleComplete}
                          onToggleReminder={onToggleReminder}
                          onOpenLogModal={onOpenLogModal}
                          onEditTask={onEditTask}
                          onDeleteTask={onDeleteTask}
                        />
                      ) : (
                        <ExternalEventTaskCard
                          key={item.id}
                          event={item.data}
                          selectedDate={selectedDate}
                          sortable
                          isManuallyCompleted={manualCompletedEvents[item.data.id]}
                          onToggleComplete={() => toggleEventCompleted(item.data.id)}
                          onClick={() => onSelectExternalEvent?.(item.data)}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Right Pane: Live Intelligence & Control Widgets */}
        <DesktopWidgetsPane
          tasks={tasks}
          allTasks={allTasks}
          externalEvents={externalEvents}
          activeTask={activeTask}
          selectedDate={selectedDate}
          sleepDurationText={sleepDurationText}
          onOpenNewTask={onNewTask}
          onSelectTab={onSelectTab}
        />
      </div>
    </div>
  );
};
