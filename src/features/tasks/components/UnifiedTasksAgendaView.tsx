"use client";

import React, { useState, useMemo, useEffect } from "react";
import { TasksHeaderWithNav, TasksTab } from "@/components/shared/TasksHeaderWithNav";
import { ProjectsView } from "@/features/projects/components/ProjectsView";
import { ActiveTaskBanner } from "@/features/tasks/components/ActiveTaskBanner";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { QuantityLoggingModal } from "@/features/tasks/components/QuantityLoggingModal";
import { LiveActivityPermissionModal } from "@/features/tasks/components/LiveActivityPermissionModal";
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { InteractiveNotificationSheet } from "@/features/notifications/components/InteractiveNotificationSheet";
import { VoiceFab } from "@/features/voice/components/VoiceFab";
import { AgendaTimeline } from "@/features/agenda/components/AgendaTimeline";
import { SleepJournalView } from "@/features/sleep/components/SleepJournalView";
import { DailyBilanView } from "@/features/sleep/components/DailyBilanView";
import { DesktopTasksView } from "@/features/tasks/components/desktop/DesktopTasksView";
import { DesktopDatePicker } from "@/features/tasks/components/desktop/DesktopDatePicker";
import { getNightSleepDuration, fetchSleepHistory } from "@/features/sleep/actions";
import { useNightMode } from "@/features/sleep/providers/NightModeProvider";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { useProjects } from "@/features/projects/hooks";
import { Task, TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { TaskAutoCompleteSuggestions } from "@/features/tasks/components/TaskAutoCompleteSuggestions";
import { mapTaskWithCompletion } from "@/features/tasks/mappers";
import { getTodayDateString } from "@/lib/dates";
import { CheckCircle2, Inbox, CalendarDays, Play, Moon, Sun, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { DAY_DROP_ID_PREFIX } from "@/features/tasks/components/HorizontalDatePicker";

import { TaskCardSkeleton } from "@/features/tasks/components/TaskCardSkeleton";
import {
  buildAndSortUnifiedStream,
  UnifiedStreamItem,
  getStoredStreamOrder,
  saveStoredStreamOrder,
} from "@/features/tasks/unifiedStream";

import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { ExternalEventTaskCard } from "@/features/calendar/components/ExternalEventTaskCard";
import { ExternalEventDetailModal } from "@/features/calendar/components/ExternalEventDetailModal";
import { isExternalEventDone } from "@/features/calendar/lib/status";

import { useSelectedDate } from "@/providers/DateProvider";

interface UnifiedTasksAgendaViewProps {
  initialTab?: TasksTab;
}

export const UnifiedTasksAgendaView: React.FC<UnifiedTasksAgendaViewProps> = ({
  initialTab = "habits",
}) => {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const { projects } = useProjects();
  const { isSleeping, bedtime, triggerSleepNow, triggerWakeUp } = useNightMode();
  const [activeTab, setActiveTab] = useState<TasksTab>(initialTab);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithCompletion | Task | null>(null);
  const [selectedLoggingTask, setSelectedLoggingTask] = useState<TaskWithCompletion | null>(null);
  const [isLiveActivityPermissionModalOpen, setIsLiveActivityPermissionModalOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [isAutoCompleteOpen, setIsAutoCompleteOpen] = useState(false);
  const [autoCompleteIndex, setAutoCompleteIndex] = useState(-1);
  const [isTestNotificationOpen, setIsTestNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExternalEvent, setSelectedExternalEvent] = useState<ExternalCalendarEvent | null>(null);
  const [manualCompletedEvents, setManualCompletedEvents] = useState<Record<string, boolean>>({});
  const quickInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePermissionNeeded = () => {
      setIsLiveActivityPermissionModalOpen(true);
    };

    const focusInput = () => {
      if (quickInputRef.current) {
        try {
          quickInputRef.current.focus({ preventScroll: false });
          quickInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {}
      }
    };

    const handleOpenQuickAdd = () => {
      setActiveTab("habits");
      [30, 100, 200, 400, 700, 1200].forEach((delay) => {
        setTimeout(focusInput, delay);
      });
    };

    // Check if deep link flagged an open quick add
    try {
      if (
        sessionStorage.getItem("mytrack_focus_quick_add") === "1" ||
        (window as any).__mytrack_focus_quick_add
      ) {
        sessionStorage.removeItem("mytrack_focus_quick_add");
        (window as any).__mytrack_focus_quick_add = false;
        handleOpenQuickAdd();
      }
    } catch {}

    window.addEventListener("mytrack:live-activity-permission-needed", handlePermissionNeeded);
    window.addEventListener("mytrack:open-quick-add", handleOpenQuickAdd);

    return () => {
      window.removeEventListener("mytrack:live-activity-permission-needed", handlePermissionNeeded);
      window.removeEventListener("mytrack:open-quick-add", handleOpenQuickAdd);
    };
  }, []);

  const { tasks, allTasks, allCompletions, isInitialLoading: isTasksInitialLoading, isSyncing: isTasksSyncing } = useTasks(selectedDate);
  const { events: externalEvents, isSyncing: isCalSyncing } = useCalendarEvents(selectedDate);

  const isGlobalSyncing = isTasksSyncing || isCalSyncing;

  const dayExternalEvents = useMemo(() => {
    return externalEvents.filter((e) => e.date === selectedDate);
  }, [externalEvents, selectedDate]);

  const [showCalendar, setShowCalendar] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mytrack_show_calendar_in_tasks") !== "false";
    }
    return true;
  });

  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mytrack_show_completed_in_tasks") !== "false";
    }
    return true;
  });

  const toggleShowCompleted = () => {
    setShowCompleted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("mytrack_show_completed_in_tasks", String(next));
      }
      return next;
    });
  };

  const {
    createTask,
    updateTask,
    updateSchedule,
    reorderTasks,
    moveOccurrence,
    toggleTaskActive,
    stopTaskExecution,
    toggleCompletion,
    updateCompletionValue,
    updateTaskStartedAt,
    deleteTask,
  } = useTaskMutations();

  const [sleepDurationText, setSleepDurationText] = useState<string | undefined>(() => {
    return getNightSleepDuration(selectedDate)?.duration?.text;
  });

  useEffect(() => {
    const updateSleep = () => {
      const dur = getNightSleepDuration(selectedDate);
      setSleepDurationText(dur?.duration?.text);
    };

    updateSleep();
    fetchSleepHistory(30).then(() => {
      updateSleep();
    });

    window.addEventListener("mytrack:sleep-auto-detected", updateSleep);
    return () => window.removeEventListener("mytrack:sleep-auto-detected", updateSleep);
  }, [selectedDate]);

  // dnd-kit: shared drag context for habit reordering + drag-onto-day rescheduling
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);

  const [streamOrder, setStreamOrder] = useState<string[]>(() => {
    return getStoredStreamOrder(selectedDate);
  });

  useEffect(() => {
    setStreamOrder(getStoredStreamOrder(selectedDate));
  }, [selectedDate]);

  const unifiedStream = useMemo(() => {
    return buildAndSortUnifiedStream(
      tasks,
      externalEvents,
      selectedDate,
      manualCompletedEvents,
      showCalendar,
      streamOrder,
      showCompleted
    );
  }, [tasks, externalEvents, selectedDate, manualCompletedEvents, showCalendar, streamOrder, showCompleted]);

  const completedCountForDay = useMemo(() => {
    const tasksDone = tasks.filter((t) => t.isCompletedToday).length;
    const eventsDone = dayExternalEvents.filter((e) =>
      isExternalEventDone(e, selectedDate, manualCompletedEvents[e.id])
    ).length;
    return tasksDone + eventsDone;
  }, [tasks, dayExternalEvents, selectedDate, manualCompletedEvents]);

  const handleHabitDragStart = (event: DragStartEvent) => {
    setActiveDragTaskId(String(event.active.id));
  };

  const handleHabitDragEnd = (event: DragEndEvent) => {
    setActiveDragTaskId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = String(over.id);
    const activeId = String(active.id);

    if (overId.startsWith(DAY_DROP_ID_PREFIX)) {
      const toDate = overId.slice(DAY_DROP_ID_PREFIX.length);
      if (toDate && toDate !== selectedDate && !activeId.startsWith("event_")) {
        moveOccurrence.mutate({ taskId: activeId, fromDate: selectedDate, toDate });
      }
      return;
    }

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
      reorderTasks.mutate(taskIds);
    }
  };

  // Active tasks for Habits view (shows active task banner regardless of selected date filter)
  const activeTasksMapped = allTasks
    .filter((t) => t.isActive && !t.isArchived)
    .map((t) => mapTaskWithCompletion(t, allCompletions, selectedDate));

  // Separate all-day tasks vs timed tasks for Agenda view
  const isTaskAllDay = (t: TaskWithCompletion) => {
    const time = t.effectiveStartTime !== undefined ? t.effectiveStartTime : t.startTime;
    return !time;
  };
  const allDayTasks = tasks.filter(isTaskAllDay);
  const timedTasks = tasks.filter((t) => !isTaskAllDay(t));

  const handleQuickAdd = (e?: React.FormEvent, autoStart = false) => {
    if (e) e.preventDefault();
    const cleanTitle = quickTitle.trim();
    if (!cleanTitle) return;

    // Check if there is an existing task with the exact same title to inherit its metadata
    const exactMatch = allTasks.find(
      (t) => t.title.trim().toLowerCase() === cleanTitle.toLowerCase() && !t.isArchived
    );

    if (exactMatch) {
      handleSelectSuggestion(exactMatch, autoStart);
    } else {
      createTask.mutate({
        title: cleanTitle,
        tag: "General",
        category: "General",
        trackingType: "BOOLEAN",
        recurrence: "ONCE",
        date: selectedDate,
        autoStart,
      } as any);
      setQuickTitle("");
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

  const handleSelectSuggestion = (matchedTask: Task, autoStart = false) => {
    // Check if matchedTask is already present on selectedDate (already scheduled, in tasks list, or completed today)
    const isAlreadyOnDate =
      tasks.some((t) => t.id === matchedTask.id) ||
      allCompletions.some((c) => c.taskId === matchedTask.id && c.date === selectedDate);

    if (isAlreadyOnDate) {
      // User is repeating this task today (e.g. morning shower done, now repeating evening shower).
      // Create a fresh new task instance copying all metadata without overwriting the previous one!
      createTask.mutate({
        title: matchedTask.title,
        category: matchedTask.category || "General",
        tag: (matchedTask as any).tag || null,
        description: matchedTask.description || null,
        priority: (matchedTask as any).priority || "NORMAL",
        projectId: matchedTask.projectId || null,
        projectCategory: matchedTask.projectCategory || null,
        enableReminders: matchedTask.enableReminders,
        reminderOffsetMinutes: matchedTask.reminderOffsetMinutes,
        reminderTimes: matchedTask.reminderTimes,
        recurrence: "ONCE",
        recurrenceConfig: null,
        trackingType: matchedTask.trackingType || "BOOLEAN",
        targetValue: matchedTask.targetValue || null,
        unit: matchedTask.unit || null,
        startTime: null,
        endTime: null,
        date: selectedDate,
        autoStart,
      } as any);
    } else {
      const isSingle = matchedTask.recurrence === "ONCE";
      updateTask.mutate({
        taskId: matchedTask.id,
        values: {
          recurrence: isSingle ? "CUSTOM" : matchedTask.recurrence,
          recurrenceConfig: isSingle ? { days: [] } : (matchedTask.recurrenceConfig || { days: [] }),
        },
      });

      if (autoStart) {
        toggleTaskActive.mutate({ taskId: matchedTask.id, date: selectedDate });
      }
    }

    setQuickTitle("");
    setIsAutoCompleteOpen(false);
    setAutoCompleteIndex(-1);
  };

  const handleCreateOrUpdateTask = (values: TaskFormValues, taskId?: string) => {
    if (taskId) {
      updateTask.mutate({ taskId, values });
    } else {
      createTask.mutate(values);
    }
    setEditingTask(null);
    setIsTaskModalOpen(false);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const handleInteractiveResponse = (action: "YES" | "NO" | "QUANTITY", value?: number) => {
    if (tasks.length > 0) {
      const targetId = tasks[0].id;
      if (action === "YES") {
        toggleCompletion.mutate({ taskId: targetId, date: selectedDate, value: null });
      } else if (action === "QUANTITY" && value !== undefined) {
        updateCompletionValue.mutate({ taskId: targetId, date: selectedDate, value });
      }
    }
  };

  // Non-active tasks for the Habits list — already ordered by sortTasksByPriority (active first,
  // then sort_order, then start time/title) via useTasks()
  const orderedTasks = tasks.filter((task) => !task.isActive);

  // Agenda Drag & Schedule handlers
  const handleDragStartTask = (e: React.DragEvent, task: TaskWithCompletion) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.setData("taskId", task.id);
  };

  const handleMoveTaskToTime = (taskId: string, startTime: string, endTime: string, targetDate?: string) => {
    const effectiveDate = targetDate || selectedDate;
    const task = allTasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: effectiveDate,
      startTime,
      endTime,
      applyToAll: !isRecurring,
    });
  };

  const handleDropToAllDay = (taskId: string, targetDate?: string) => {
    const effectiveDate = targetDate || selectedDate;
    const task = allTasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: effectiveDate,
      startTime: null,
      endTime: null,
      applyToAll: !isRecurring,
    });
  };

  // Resolve the day the pointer is literally over first (accurate for the narrow day-strip
  // cells); only fall back to nearest-center matching when the pointer isn't over anything —
  // pure closestCenter could otherwise match a day cell several days away.
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  };

  const handleTabChange = (tab: TasksTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        tab === "agenda"
          ? "/agenda"
          : tab === "projects"
          ? "/projects"
          : "/tasks"
      );
    }
  };

  return (
    <>
      <DndContext
        sensors={dndSensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleHabitDragStart}
        onDragEnd={handleHabitDragEnd}
      >
        <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-[#0E0F12] relative overflow-hidden">
          {/* 1. Permanent Fixed Header Area with Profile Icon Top Right & Adaptive Date Picker */}
          <div className="flex-shrink-0 z-30 shadow-md">
            <TasksHeaderWithNav
              title={
                activeTab === "habits"
                  ? "Ma Liste"
                  : activeTab === "agenda"
                  ? "Mon Agenda"
                  : activeTab === "projects"
                  ? "Projets"
                  : "Journal & Bilan"
              }
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              activeTab={activeTab}
              onChangeTab={handleTabChange}
              isDragActive={Boolean(activeDragTaskId)}
              isSyncing={isGlobalSyncing}
              onDropDate={(dateStr, taskId) =>
                moveOccurrence.mutate({ taskId, fromDate: selectedDate, toDate: dateStr })
              }
            />
          </div>

          {/* 2. Seamless View Body */}
          {activeTab === "projects" ? (
            /* PROJETS TAB */
            <ProjectsView
              allTasks={allTasks}
              externalEvents={externalEvents}
              completions={allCompletions}
              onEditTask={(t) => {
                setEditingTask(t);
                setIsTaskModalOpen(true);
              }}
            />
          ) : activeTab === "habits" ? (
            <>
              {/* MOBILE VERSION: Max-width 7-day strip style */}
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-3 pb-36 space-y-3.5 max-w-lg mx-auto w-full touch-pan-y md:hidden"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xl font-bold text-white tracking-tight">Aujourd&apos;hui</h2>
                  <div className="flex items-center gap-1.5">
                    {/* Bouton Je me couche (quand non en sommeil) */}
                    {!isSleeping && (
                      <button
                        type="button"
                        onClick={triggerSleepNow}
                        title="Démarrer une période de sommeil"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border bg-[#1E1B38] border-[#7C3AED]/50 text-[#C4B5FD] hover:bg-[#2B2750] active:scale-95 shadow-sm shadow-[#7C3AED]/20"
                      >
                        <Moon className="w-3.5 h-3.5 fill-current text-[#A78BFA]" />
                        <span>Je me couche</span>
                      </button>
                    )}

                    {/* Toggle pour afficher ou masquer les tâches déjà faites */}
                    <button
                      type="button"
                      onClick={toggleShowCompleted}
                      title={showCompleted ? "Masquer les tâches déjà faites" : "Afficher les tâches déjà faites"}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border",
                        showCompleted
                          ? "bg-[#D4F63D]/15 border-[#D4F63D]/40 text-[#D4F63D]"
                          : "bg-[#1C1D22] border-[#282A30] text-[#6B7280] hover:text-[#9CA3AF]"
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Faites {showCompleted ? "ON" : "OFF"}</span>
                    </button>

                    {/* Toggle Agenda */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowCalendar((prev) => {
                          const next = !prev;
                          if (typeof window !== "undefined") {
                            localStorage.setItem("mytrack_show_calendar_in_tasks", String(next));
                          }
                          return next;
                        });
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border",
                        showCalendar
                          ? "bg-[#3B82F6]/15 border-[#3B82F6]/40 text-[#60A5FA]"
                          : "bg-[#1C1D22] border-[#282A30] text-[#6B7280]"
                      )}
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Agenda {showCalendar ? "ON" : "OFF"}</span>
                    </button>
                  </div>
                </div>

                {/* Bannière Mode Sommeil Actif (quand l'utilisateur s'est couché) */}
                {isSleeping && (
                  <div className="w-full bg-[#18152E] border border-[#7C3AED]/40 rounded-2xl p-3 shadow-lg shadow-[#7C3AED]/15 flex flex-col gap-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#7C3AED]/25 border border-[#7C3AED]/40 flex items-center justify-center text-[#C4B5FD]">
                          <Moon className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white">Mode Sommeil en cours</span>
                          <span className="ml-1.5 text-[11px] text-[#A78BFA] font-medium">• Couché à {bedtime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={triggerSleepNow}
                        title="Actualiser l'heure de coucher à maintenant"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#231E42] hover:bg-[#2F2958] border border-[#5B4896] text-[#C4B5FD] text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Actualiser le coucher</span>
                      </button>

                      <button
                        type="button"
                        onClick={triggerWakeUp}
                        title="Terminer la nuit et enregistrer le réveil"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#D4F63D] hover:bg-[#c2e428] text-black text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-md shadow-[#D4F63D]/20"
                      >
                        <Sun className="w-3.5 h-3.5 text-black" />
                        <span>Je me réveille</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Task Input Bar */}
                <form
                  onSubmit={(e) => {
                    if (autoCompleteIndex >= 0 && autoCompleteIndex < matchingTasks.length) {
                      e.preventDefault();
                      handleSelectSuggestion(matchingTasks[autoCompleteIndex], false);
                      return;
                    }
                    handleQuickAdd(e, false);
                    setIsAutoCompleteOpen(false);
                    setAutoCompleteIndex(-1);
                  }}
                  className="w-full relative"
                >
                  <div className="relative flex items-center">
                    <div className="absolute left-4 text-[#D4F63D]">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <input
                      ref={quickInputRef}
                      data-testid="task-quick-add-input"
                      type="text"
                      placeholder="Nom de la tâche"
                      value={quickTitle}
                      onFocus={() => {
                        if (quickTitle.trim()) setIsAutoCompleteOpen(true);
                      }}
                      onChange={(e) => {
                        setQuickTitle(e.target.value);
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
                        "w-full pl-11 py-3 rounded-2xl bg-[#1C1D22] border border-[#282A30] text-sm text-white focus:border-[#D4F63D] outline-none placeholder-[#6B7280] shadow-sm transition-all",
                        quickTitle.trim() ? "pr-28" : "pr-4"
                      )}
                    />
                    {quickTitle.trim() && (
                      <div className="absolute right-2 flex items-center gap-1.5">
                        <button
                          data-testid="task-quick-add-start-btn"
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (autoCompleteIndex >= 0 && autoCompleteIndex < matchingTasks.length) {
                              handleSelectSuggestion(matchingTasks[autoCompleteIndex], true);
                              return;
                            }
                            handleQuickAdd(undefined, true);
                            setIsAutoCompleteOpen(false);
                            setAutoCompleteIndex(-1);
                          }}
                          title="Créer et démarrer la tâche"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Démarrer</span>
                        </button>
                      </div>
                    )}
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
                      handleSelectSuggestion(task, autoStart);
                    }}
                  />
                </form>

                {/* Active Running Task Banners */}
                {activeTasksMapped.length > 0 && (
                  <div className="space-y-3">
                    {activeTasksMapped.map((activeItem) => (
                      <ActiveTaskBanner
                        key={activeItem.id}
                        task={activeItem}
                        onStop={(taskId) => stopTaskExecution.mutate({ taskId, date: selectedDate })}
                        onComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
                        onOpenLogModal={(t) => setSelectedLoggingTask(t)}
                        onUpdateStartTime={(taskId, newTime) =>
                          updateTaskStartedAt.mutate({ taskId, startedAtTime: newTime })
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Unified Tasks & External Calendar Events Stream */}
                <div className="space-y-2.5 pt-1">
                  {isTasksInitialLoading && unifiedStream.length === 0 ? (
                    <TaskCardSkeleton count={3} />
                  ) : unifiedStream.length === 0 ? (
                    <div className="p-8 text-center bg-[#1C1D22] border border-[#282A30] rounded-3xl my-4">
                      <Inbox className="w-10 h-10 text-[#6B7280] mx-auto mb-2" />
                      <h4 className="text-base font-bold text-white">Aucun élément programmé</h4>
                      <p className="text-xs text-[#8E929E] mt-1 mb-4">
                        Tu n&apos;as aucune tâche ni événement pour cette date.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTask(null);
                          setIsTaskModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-full bg-[#D4F63D] text-black font-bold text-xs cursor-pointer"
                      >
                        Créer une tâche
                      </button>
                    </div>
                  ) : (
                    <SortableContext items={unifiedStream.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                      {unifiedStream.map((item) =>
                        item.type === "task" ? (
                          <TaskCard
                            key={item.id}
                            task={item.data}
                            sortable
                            onToggleActive={(id) => toggleTaskActive.mutate({ taskId: id, date: selectedDate })}
                            onToggleComplete={(id) => toggleCompletion.mutate({ taskId: id, date: selectedDate })}
                            onToggleReminder={(id) => {
                              const target = tasks.find((t) => t.id === id);
                              const newEnable = target ? !(target.enableReminders !== false) : true;
                              updateTask.mutate({ taskId: id, values: { enableReminders: newEnable } });
                            }}
                            onOpenLogModal={(t) => setSelectedLoggingTask(t)}
                            onEditTask={(t) => {
                              setEditingTask(t);
                              setIsTaskModalOpen(true);
                            }}
                            onDeleteTask={(id) => deleteTask.mutate(id)}
                          />
                        ) : (
                          <ExternalEventTaskCard
                            key={item.id}
                            event={item.data}
                            selectedDate={selectedDate}
                            sortable
                            isManuallyCompleted={manualCompletedEvents[item.data.id]}
                            onToggleComplete={() => {
                              setManualCompletedEvents((prev) => {
                                const current = prev[item.data.id];
                                const defaultDone = isExternalEventDone(item.data, selectedDate);
                                return { ...prev, [item.data.id]: current !== undefined ? !current : !defaultDone };
                              });
                            }}
                            onClick={() => setSelectedExternalEvent(item.data)}
                          />
                        )
                      )}
                    </SortableContext>
                  )}

                  {/* Subtle helper banner when completed items are hidden */}
                  {!showCompleted && completedCountForDay > 0 && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#1C1D22]/80 border border-[#282A30] text-xs text-[#8E929E]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4F63D]" />
                        <span>
                          {completedCountForDay} élément{completedCountForDay > 1 ? "s" : ""} terminé{completedCountForDay > 1 ? "s" : ""} masqué{completedCountForDay > 1 ? "s" : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={toggleShowCompleted}
                        className="text-xs font-bold text-[#D4F63D] hover:underline cursor-pointer"
                      >
                        Afficher
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* DESKTOP VERSION: Fully responsive 2-column list & widgets view */}
              <div className="hidden md:flex md:flex-1 md:min-h-0 w-full overflow-hidden bg-[#0E0F12]">
                <DesktopTasksView
                  tasks={tasks}
                  allTasks={allTasks}
                  externalEvents={externalEvents}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  searchQuery={searchQuery}
                  onNewTask={handleNewTask}
                  isInitialLoading={isTasksInitialLoading}
                  isSyncing={isGlobalSyncing}
                  showCompleted={showCompleted}
                  onToggleShowCompleted={toggleShowCompleted}
                  onEditTask={(t) => {
                    setEditingTask(t);
                    setIsTaskModalOpen(true);
                  }}
                  onToggleComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
                  onToggleActive={(taskId) => toggleTaskActive.mutate({ taskId, date: selectedDate })}
                  onStopTask={(taskId) => stopTaskExecution.mutate({ taskId, date: selectedDate })}
                  onToggleReminder={(taskId) => {
                    const target = tasks.find((t) => t.id === taskId);
                    const newEnable = target ? !(target.enableReminders !== false) : true;
                    updateTask.mutate({ taskId, values: { enableReminders: newEnable } });
                  }}
                  onOpenLogModal={(t) => setSelectedLoggingTask(t)}
                  onDeleteTask={(taskId) => deleteTask.mutate(taskId)}
                  onReorderTasks={(taskIds) => reorderTasks.mutate(taskIds)}
                  onUpdateTaskStartedAt={(taskId, newTime) =>
                    updateTaskStartedAt.mutate({ taskId, startedAtTime: newTime })
                  }
                  onSelectExternalEvent={(evt) => setSelectedExternalEvent(evt)}
                  quickTitle={quickTitle}
                  onQuickTitleChange={setQuickTitle}
                  onQuickAdd={(e) => handleQuickAdd(e, false)}
                  onQuickAddAndStart={() => handleQuickAdd(undefined, true)}
                  onSelectSuggestion={handleSelectSuggestion}
                  onSelectTab={handleTabChange}
                  sleepDurationText={sleepDurationText}
                />
              </div>
            </>
          ) : (
            /* AGENDA TIMELINE TAB */
            <>
              {/* Mobile/shared */}
              <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden w-full">
                <AgendaTimeline
                  selectedDate={selectedDate}
                  tasks={tasks}
                  allTasks={allTasks}
                  allCompletions={allCompletions}
                  onSelectDate={setSelectedDate}
                  onToggleComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
                  onToggleReminder={(taskId) => {
                    const target = tasks.find((t) => t.id === taskId) || allTasks.find((t) => t.id === taskId);
                    const newEnable = target ? !(target.enableReminders !== false) : true;
                    updateTask.mutate({ taskId, values: { enableReminders: newEnable } });
                  }}
                  onEditTask={(task) => {
                    setEditingTask(task);
                    setIsTaskModalOpen(true);
                  }}
                  onDeleteTask={(taskId) => deleteTask.mutate(taskId)}
                  onUpdateTask={(taskId, values) => updateTask.mutate({ taskId, values })}
                  onCreateTaskAtTime={(date, startTime, endTime) => {
                    createTask.mutate({
                      title: "Nouvelle tâche",
                      date,
                      startTime,
                      endTime,
                      category: "General",
                      trackingType: "BOOLEAN",
                      recurrence: "ONCE",
                    } as any);
                  }}
                  onMoveTaskToTime={handleMoveTaskToTime}
                  onDropToAllDay={handleDropToAllDay}
                  onMoveTaskOccurrence={(taskId, targetDate) =>
                    moveOccurrence.mutate({ taskId, fromDate: selectedDate, toDate: targetDate })
                  }
                  onDragStartTask={handleDragStartTask}
                  onDuplicateTask={(t) => {
                    createTask.mutate({
                      title: t.title,
                      category: t.category || "General",
                      tag: (t as any).tag || null,
                      description: t.description || null,
                      priority: (t as any).priority || "NORMAL",
                      projectId: t.projectId || null,
                      projectCategory: t.projectCategory || null,
                      enableReminders: t.enableReminders,
                      reminderOffsetMinutes: t.reminderOffsetMinutes,
                      reminderTimes: t.reminderTimes,
                      recurrence: "ONCE",
                      recurrenceConfig: null,
                      trackingType: t.trackingType || "BOOLEAN",
                      targetValue: t.targetValue || null,
                      unit: t.unit || null,
                      startTime: null,
                      endTime: null,
                      date: selectedDate,
                    } as any);
                  }}
                />
              </div>
            </>
          )}

        </div>
      </DndContext>

      {/* Task Creation & Edition Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen || Boolean(editingTask)}
        initialTask={editingTask}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateOrUpdateTask}
      />

      {/* Quantity / Duration logging modal */}
      <QuantityLoggingModal
        task={selectedLoggingTask}
        isOpen={Boolean(selectedLoggingTask)}
        onClose={() => setSelectedLoggingTask(null)}
        onSaveValue={(taskId, value) => {
          updateCompletionValue.mutate({ taskId, date: selectedDate, value });
        }}
      />

      {/* Actionable Notification Simulation Sheet */}
      <InteractiveNotificationSheet
        isOpen={isTestNotificationOpen}
        question="As-tu fait tes pompes aujourd'hui ?"
        taskTitle="Pompes"
        onClose={() => setIsTestNotificationOpen(false)}
        onRespond={handleInteractiveResponse}
      />

      {/* Live Activity iOS Permission Alert Modal */}
      <LiveActivityPermissionModal
        isOpen={isLiveActivityPermissionModalOpen}
        onClose={() => setIsLiveActivityPermissionModalOpen(false)}
      />

      {/* External Calendar Event Detail Modal */}
      <ExternalEventDetailModal
        event={selectedExternalEvent}
        onClose={() => setSelectedExternalEvent(null)}
      />

      {/* Dual Floating Action Buttons: New Task (+) and Voice AI (Mic) */}
      <VoiceFab
        selectedDate={selectedDate}
        allTasks={allTasks}
        onNewTask={handleNewTask}
      />
    </>
  );
};

