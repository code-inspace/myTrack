"use client";

import React, { useState, useMemo } from "react";
import { TasksHeaderWithNav, TasksTab } from "@/components/shared/TasksHeaderWithNav";
import { ProjectsView } from "@/features/projects/components/ProjectsView";
import { ActiveTaskBanner } from "@/features/tasks/components/ActiveTaskBanner";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { QuantityLoggingModal } from "@/features/tasks/components/QuantityLoggingModal";
import { InteractiveNotificationSheet } from "@/features/notifications/components/InteractiveNotificationSheet";
import { VoiceFab } from "@/features/voice/components/VoiceFab";
import { AllDaySection } from "@/features/agenda/components/AllDaySection";
import { AgendaTimeline } from "@/features/agenda/components/AgendaTimeline";
import { SleepJournalView } from "@/features/sleep/components/SleepJournalView";
import { DailyBilanView } from "@/features/sleep/components/DailyBilanView";
import { DesktopHeader } from "@/components/desktop/DesktopHeader";
import { DesktopTasksView } from "@/features/tasks/components/desktop/DesktopTasksView";
import { getNightSleepDuration } from "@/features/sleep/actions";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { Task, TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { CheckCircle2, Inbox, CalendarDays } from "lucide-react";
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

interface UnifiedTasksAgendaViewProps {
  initialTab?: TasksTab;
}

export const UnifiedTasksAgendaView: React.FC<UnifiedTasksAgendaViewProps> = ({
  initialTab = "habits",
}) => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<TasksTab>(initialTab);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithCompletion | Task | null>(null);
  const [selectedLoggingTask, setSelectedLoggingTask] = useState<TaskWithCompletion | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [isTestNotificationOpen, setIsTestNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { tasks, allTasks, allCompletions } = useTasks(selectedDate);

  const {
    createTask,
    updateTask,
    updateSchedule,
    reorderTasks,
    moveOccurrence,
    toggleTaskActive,
    toggleCompletion,
    updateCompletionValue,
    updateTaskStartedAt,
    deleteTask,
  } = useTaskMutations();

  // Desktop stats calculation
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.isCompletedToday).length;
  const activeCount = tasks.filter((t) => t.isActive).length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const sleepDuration = useMemo(() => getNightSleepDuration(selectedDate), [selectedDate]);
  const sleepDurationText = sleepDuration?.duration?.text;

  // dnd-kit: shared drag context for habit reordering + drag-onto-day rescheduling
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);

  const handleHabitDragStart = (event: DragStartEvent) => {
    setActiveDragTaskId(String(event.active.id));
  };

  const handleHabitDragEnd = (event: DragEndEvent) => {
    setActiveDragTaskId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = String(over.id);

    if (overId.startsWith(DAY_DROP_ID_PREFIX)) {
      const toDate = overId.slice(DAY_DROP_ID_PREFIX.length);
      if (toDate && toDate !== selectedDate) {
        moveOccurrence.mutate({ taskId: String(active.id), fromDate: selectedDate, toDate });
      }
      return;
    }

    const oldIndex = orderedTasks.findIndex((t) => t.id === active.id);
    const newIndex = orderedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedTasks, oldIndex, newIndex);
    reorderTasks.mutate(reordered.map((t) => t.id));
  };

  // Active tasks for Habits view (shows all tasks scheduled for the date)
  const activeTasksMapped = tasks.filter((t) => t.isActive);

  // Separate all-day tasks vs timed tasks for Agenda view
  const isTaskAllDay = (t: TaskWithCompletion) => {
    const time = t.effectiveStartTime !== undefined ? t.effectiveStartTime : t.startTime;
    return !time;
  };
  const allDayTasks = tasks.filter(isTaskAllDay);
  const timedTasks = tasks.filter((t) => !isTaskAllDay(t));

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    createTask.mutate({
      title: quickTitle.trim(),
      category: "General",
      trackingType: "BOOLEAN",
      recurrence: "ONCE",
      date: selectedDate,
    });
    setQuickTitle("");
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

  const handleDropToAllDay = (taskId: string) => {
    const task = allTasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: selectedDate,
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
          : tab === "sleep"
          ? "/sleep"
          : tab === "bilan"
          ? "/bilan"
          : tab === "projects"
          ? "/projects"
          : "/tasks"
      );
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP VIEW LAYOUT (hidden on mobile, flex on md and above)          */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-col flex-1 h-screen max-h-screen overflow-hidden bg-[#0E0F12]">
        {/* Desktop Top Header Bar with KPIs and Search */}
        <DesktopHeader
          completedCount={completedCount}
          totalCount={totalCount}
          activeCount={activeCount}
          completionRate={completionRate}
          sleepDurationText={sleepDurationText}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNewTask={handleNewTask}
        />

        {/* Desktop Content Switcher */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTab === "habits" ? (
            <DesktopTasksView
              tasks={tasks}
              allTasks={allTasks}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              searchQuery={searchQuery}
              onNewTask={handleNewTask}
              onEditTask={(t) => {
                setEditingTask(t);
                setIsTaskModalOpen(true);
              }}
              onToggleComplete={(id) => toggleCompletion.mutate({ taskId: id, date: selectedDate })}
              onToggleActive={(id) => toggleTaskActive.mutate({ taskId: id, date: selectedDate })}
              onToggleReminder={(id) => {
                const target = tasks.find((t) => t.id === id);
                const newEnable = target ? !(target.enableReminders !== false) : true;
                updateTask.mutate({ taskId: id, values: { enableReminders: newEnable } });
              }}
              onOpenLogModal={(t) => setSelectedLoggingTask(t)}
              onDeleteTask={(id) => deleteTask.mutate(id)}
              onReorderTasks={(ids) => reorderTasks.mutate(ids)}
              onUpdateTaskStartedAt={(taskId, newTime) =>
                updateTaskStartedAt.mutate({ taskId, startedAtTime: newTime })
              }
              quickTitle={quickTitle}
              onQuickTitleChange={setQuickTitle}
              onQuickAdd={handleQuickAdd}
              onSelectTab={handleTabChange}
              sleepDurationText={sleepDurationText}
            />
          ) : activeTab === "projects" ? (
            <div className="flex-1 min-h-0 flex flex-col px-6 py-4 overflow-hidden">
              <ProjectsView
                allTasks={allTasks}
                onEditTask={(t) => {
                  setEditingTask(t);
                  setIsTaskModalOpen(true);
                }}
              />
            </div>
          ) : activeTab === "agenda" ? (
            <div className="flex-1 min-h-0 flex flex-col px-6 py-4 overflow-hidden">
              <AgendaTimeline
                selectedDate={selectedDate}
                tasks={timedTasks}
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
                onMoveTaskToTime={handleMoveTaskToTime}
                onDragStartTask={handleDragStartTask}
              />
            </div>
          ) : activeTab === "sleep" ? (
            <div className="flex-1 min-h-0 flex flex-col px-6 py-4 overflow-y-auto max-w-4xl mx-auto w-full">
              <SleepJournalView selectedDate={selectedDate} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col px-6 py-4 overflow-y-auto max-w-4xl mx-auto w-full">
              <DailyBilanView selectedDate={selectedDate} />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE VIEW LAYOUT (flex on mobile, hidden on md and above)            */}
      {/* ========================================================================= */}
      <DndContext
        sensors={dndSensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleHabitDragStart}
        onDragEnd={handleHabitDragEnd}
      >
        <div className="md:hidden flex-1 flex flex-col h-screen max-h-screen bg-[#0E0F12] relative overflow-hidden">
          {/* 1. Permanent Fixed Header Area: zero reload / zero unmount */}
          <div className="flex-shrink-0 z-30 shadow-md">
            <TasksHeaderWithNav
              title={
                activeTab === "habits"
                  ? "Ma Liste"
                  : activeTab === "agenda"
                  ? "Mon Agenda"
                  : activeTab === "sleep"
                  ? "Sommeil"
                  : activeTab === "projects"
                  ? "Projets"
                  : "Journal & Bilan"
              }
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              activeTab={activeTab}
              onChangeTab={handleTabChange}
              isDragActive={Boolean(activeDragTaskId)}
            />

            {/* Fixed "Jour entier" Section when in Agenda mode */}
            {activeTab === "agenda" && (
              <AllDaySection
                tasks={allDayTasks}
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
                onDropToAllDay={handleDropToAllDay}
                onDragStartTask={handleDragStartTask}
              />
            )}
          </div>

          {/* 2. Seamless View Body */}
          {activeTab === "bilan" ? (
            /* BILAN & GRATITUDE & MANIFESTATION TAB */
            <DailyBilanView selectedDate={selectedDate} />
          ) : activeTab === "sleep" ? (
            /* SOMMEIL TAB */
            <SleepJournalView selectedDate={selectedDate} />
          ) : activeTab === "projects" ? (
            /* PROJETS TAB */
            <ProjectsView
              allTasks={allTasks}
              onEditTask={(t) => {
                setEditingTask(t);
                setIsTaskModalOpen(true);
              }}
            />
          ) : activeTab === "habits" ? (
            /* HABIT LIST TAB */
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-3 pb-36 space-y-3.5 max-w-md mx-auto w-full touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-bold text-white tracking-tight">Aujourd&apos;hui</h2>
              </div>

              {/* Quick Task Input Bar */}
              <form onSubmit={handleQuickAdd} className="w-full relative">
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-[#D4F63D]">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Nom de la tâche"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#1C1D22] border border-[#282A30] text-sm text-white focus:border-[#D4F63D] outline-none placeholder-[#6B7280] shadow-sm transition-all"
                  />
                </div>
              </form>

              {/* Active Running Task Banners */}
              {activeTasksMapped.length > 0 && (
                <div className="space-y-3">
                  {activeTasksMapped.map((activeItem) => (
                    <ActiveTaskBanner
                      key={activeItem.id}
                      task={activeItem}
                      onStop={(taskId) => toggleTaskActive.mutate({ taskId, date: selectedDate })}
                      onComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
                      onOpenLogModal={(t) => setSelectedLoggingTask(t)}
                      onUpdateStartTime={(taskId, newTime) =>
                        updateTaskStartedAt.mutate({ taskId, startedAtTime: newTime })
                      }
                    />
                  ))}
                </div>
              )}

              {/* Tasks List with Drag & Drop Reordering */}
              <div className="space-y-2.5 pt-1">
                {orderedTasks.length === 0 ? (
                  <div className="p-8 text-center bg-[#1C1D22] border border-[#282A30] rounded-3xl my-4">
                    <Inbox className="w-10 h-10 text-[#6B7280] mx-auto mb-2" />
                    <h4 className="text-base font-bold text-white">Aucune tâche programmée</h4>
                    <p className="text-xs text-[#8E929E] mt-1 mb-4">
                      Tu n&apos;as aucune tâche active pour cette date.
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
                  <SortableContext items={orderedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {orderedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
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
                    ))}
                  </SortableContext>
                )}
              </div>
            </div>
          ) : (
            /* AGENDA TIMELINE TAB */
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
              <AgendaTimeline
                selectedDate={selectedDate}
                tasks={timedTasks}
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
                onMoveTaskToTime={handleMoveTaskToTime}
                onDragStartTask={handleDragStartTask}
              />
            </div>
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

      {/* Dual Floating Action Buttons: New Task (+) and Voice AI (Mic) */}
      <VoiceFab
        selectedDate={selectedDate}
        allTasks={allTasks}
        onNewTask={handleNewTask}
      />
    </>
  );
};

