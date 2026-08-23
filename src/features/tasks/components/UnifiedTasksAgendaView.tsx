"use client";

import React, { useState } from "react";
import { TasksHeaderWithNav } from "@/components/shared/TasksHeaderWithNav";
import { ActiveTaskBanner } from "@/features/tasks/components/ActiveTaskBanner";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { QuantityLoggingModal } from "@/features/tasks/components/QuantityLoggingModal";
import { InteractiveNotificationSheet } from "@/features/notifications/components/InteractiveNotificationSheet";
import { VoiceFab } from "@/features/voice/components/VoiceFab";
import { AllDaySection } from "@/features/agenda/components/AllDaySection";
import { AgendaTimeline } from "@/features/agenda/components/AgendaTimeline";
import { SleepJournalView } from "@/features/sleep/components/SleepJournalView";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { CheckCircle2, Inbox, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnifiedTasksAgendaViewProps {
  initialTab?: "habits" | "agenda" | "sleep";
}

export const UnifiedTasksAgendaView: React.FC<UnifiedTasksAgendaViewProps> = ({
  initialTab = "habits",
}) => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<"habits" | "agenda" | "sleep">(initialTab);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithCompletion | null>(null);
  const [selectedLoggingTask, setSelectedLoggingTask] = useState<TaskWithCompletion | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [isTestNotificationOpen, setIsTestNotificationOpen] = useState(false);

  const { tasks, allTasks } = useTasks(selectedDate);

  // Drag and drop priority reordering state for Habits tab
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mytrack_custom_task_order");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const {
    createTask,
    updateTask,
    updateSchedule,
    toggleTaskActive,
    toggleCompletion,
    updateCompletionValue,
    updateTaskStartedAt,
    deleteTask,
  } = useTaskMutations();

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
      recurrence: "DAILY",
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

  // Reorder tasks according to custom drag-and-drop priority
  const nonActiveTasks = tasks.filter((task) => !task.isActive);
  const orderedTasks = [...nonActiveTasks].sort((a, b) => {
    const aIndex = customOrder.indexOf(a.id);
    const bIndex = customOrder.indexOf(b.id);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newTasks = [...orderedTasks];
    const [draggedItem] = newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, draggedItem);

    const newOrderIds = newTasks.map((t) => t.id);
    setCustomOrder(newOrderIds);
    setDraggedIndex(targetIndex);
    try {
      localStorage.setItem("mytrack_custom_task_order", JSON.stringify(newOrderIds));
    } catch {}
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Agenda Drag & Schedule handlers
  const handleDragStartTask = (e: React.DragEvent, task: TaskWithCompletion) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.setData("taskId", task.id);
  };

  const handleMoveTaskToTime = (taskId: string, startTime: string, endTime: string) => {
    const task = allTasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: selectedDate,
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

  const handleTabChange = (tab: "habits" | "agenda" | "sleep") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        tab === "agenda" ? "/agenda" : tab === "sleep" ? "/sleep" : "/tasks"
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen bg-[#0E0F12] relative overflow-hidden">
      {/* 1. Permanent Fixed Header Area: zero reload / zero unmount */}
      <div className="flex-shrink-0 z-30 shadow-md">
        <TasksHeaderWithNav
          title={
            activeTab === "habits"
              ? "Mes Habitudes"
              : activeTab === "agenda"
              ? "Mon Agenda"
              : "Sommeil & Bilan"
          }
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onNewTask={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
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
      {activeTab === "sleep" ? (
        /* SOMMEIL & BILAN TAB */
        <SleepJournalView selectedDate={selectedDate} />
      ) : activeTab === "habits" ? (
        /* HABIT LIST TAB */
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-3.5 max-w-md mx-auto w-full">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Aujourd'hui</h2>
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
                  Tu n'as aucune tâche active pour cette date.
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
              orderedTasks.map((task, idx) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={idx}
                  isDraggable={true}
                  isDragging={draggedIndex === idx}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
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
              ))
            )}
          </div>
        </div>
      ) : (
        /* AGENDA TIMELINE TAB */
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          <AgendaTimeline
            selectedDate={selectedDate}
            tasks={timedTasks}
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

          {/* Floating Bottom Return Pill */}
          <div className="absolute bottom-20 inset-x-0 px-4 flex items-center justify-between pointer-events-none z-30">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={cn(
                "pointer-events-auto bg-[#1F2228]/90 hover:bg-[#282B33] active:scale-95 text-white font-bold text-xs py-2.5 px-4 rounded-full shadow-2xl backdrop-blur-md border border-[#333742] transition-all cursor-pointer",
                selectedDate === todayStr ? "opacity-40 pointer-events-none" : "opacity-100"
              )}
            >
              Aujourd'hui
            </button>

            <div className="pointer-events-auto bg-[#1F2228]/90 text-white font-semibold text-xs py-2 px-3.5 rounded-full shadow-2xl backdrop-blur-md border border-[#333742] flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-[#D4F63D]" />
              <span>{tasks.length} tâche{tasks.length > 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      )}

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

      {/* Floating Microphone Voice Action Button */}
      <VoiceFab selectedDate={selectedDate} />
    </div>
  );
};
