"use client";

import React, { useState } from "react";
import { TasksHeaderWithNav } from "@/components/shared/TasksHeaderWithNav";
import { AllDaySection } from "./AllDaySection";
import { AgendaTimeline } from "./AgendaTimeline";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { QuantityLoggingModal } from "@/features/tasks/components/QuantityLoggingModal";
import { VoiceFab } from "@/features/voice/components/VoiceFab";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export const AgendaView: React.FC = () => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithCompletion | null>(null);
  const [selectedLoggingTask, setSelectedLoggingTask] = useState<TaskWithCompletion | null>(null);

  const { tasks, allTasks, isLoading } = useTasks(selectedDate);
  const {
    createTask,
    updateTask,
    updateSchedule,
    toggleCompletion,
    updateCompletionValue,
  } = useTaskMutations();

  // Separate all-day tasks vs timed tasks
  const isTaskAllDay = (t: TaskWithCompletion) => {
    const time = t.effectiveStartTime !== undefined ? t.effectiveStartTime : t.startTime;
    return !time;
  };
  const allDayTasks = tasks.filter(isTaskAllDay);
  const timedTasks = tasks.filter((t) => !isTaskAllDay(t));

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

  const handleCreateOrUpdateTask = (values: TaskFormValues, taskId?: string) => {
    if (taskId) {
      updateTask.mutate({ taskId, values });
    } else {
      createTask.mutate(values);
    }
    setEditingTask(null);
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen bg-[#0E0F12] relative overflow-hidden">
      {/* 1. Fixed Header Area: TasksHeaderWithNav */}
      <div className="flex-shrink-0 z-30 shadow-md">
        <TasksHeaderWithNav
          title="Mon Agenda"
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onNewTask={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
        />

        {/* 2. Fixed "Jour entier" Section directly below header */}
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
      </div>

      {/* 3. Scrollable Hourly Timeline Area */}
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
      </div>

      {/* 4. Floating Bottom Return Pill */}
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

      {/* Task Creation & Edition Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        initialTask={editingTask}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateOrUpdateTask}
      />

      {/* Quantity / Duration Modal */}
      <QuantityLoggingModal
        task={selectedLoggingTask}
        isOpen={Boolean(selectedLoggingTask)}
        onClose={() => setSelectedLoggingTask(null)}
        onSaveValue={(taskId, value) => {
          updateCompletionValue.mutate({ taskId, date: selectedDate, value });
        }}
      />

      {/* Floating Microphone Voice Action Button */}
      <VoiceFab selectedDate={selectedDate} />
    </div>
  );
};
