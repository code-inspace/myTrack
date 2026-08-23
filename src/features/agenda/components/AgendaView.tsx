"use client";

import React, { useState } from "react";
import { AgendaHeader } from "./AgendaHeader";
import { AllDaySection } from "./AllDaySection";
import { AgendaTimeline } from "./AgendaTimeline";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { QuantityLoggingModal } from "@/features/tasks/components/QuantityLoggingModal";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { Sparkles, CalendarDays, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const AgendaView: React.FC = () => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedLoggingTask, setSelectedLoggingTask] = useState<TaskWithCompletion | null>(null);

  const { tasks, isLoading } = useTasks(selectedDate);
  const {
    createTask,
    updateSchedule,
    toggleCompletion,
    updateCompletionValue,
  } = useTaskMutations();

  // Separate all-day tasks vs timed tasks
  const allDayTasks = tasks.filter((t) => !(t.effectiveStartTime || t.startTime));
  const timedTasks = tasks.filter((t) => Boolean(t.effectiveStartTime || t.startTime));

  const handleDragStartTask = (e: React.DragEvent, task: TaskWithCompletion) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.setData("taskId", task.id);
  };

  const handleMoveTaskToTime = (taskId: string, startTime: string, endTime: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: selectedDate,
      startTime,
      endTime,
      applyToAll: !isRecurring, // By default for recurring tasks, apply to this occurrence
    });
  };

  const handleDropToAllDay = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: selectedDate,
      startTime: null,
      endTime: null,
      applyToAll: !isRecurring,
    });
  };

  const handleCreateTask = (values: TaskFormValues) => {
    createTask.mutate(values);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0E0F12] relative overflow-hidden">
      {/* 1. iOS Style Header */}
      <AgendaHeader
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenNewTaskModal={() => setIsTaskModalOpen(true)}
      />

      {/* 2. All-Day Section */}
      <AllDaySection
        tasks={allDayTasks}
        onToggleComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
        onDropToAllDay={handleDropToAllDay}
        onDragStartTask={handleDragStartTask}
        onSelectTask={(task) => {
          if (task.trackingType === "NUMBER" || task.trackingType === "QUANTITY" || task.trackingType === "DURATION") {
            setSelectedLoggingTask(task);
          }
        }}
      />

      {/* 3. Hourly Timeline */}
      <AgendaTimeline
        selectedDate={selectedDate}
        tasks={timedTasks}
        onToggleComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
        onMoveTaskToTime={handleMoveTaskToTime}
        onDragStartTask={handleDragStartTask}
        onSelectTask={(task) => {
          if (task.trackingType === "NUMBER" || task.trackingType === "QUANTITY" || task.trackingType === "DURATION") {
            setSelectedLoggingTask(task);
          }
        }}
      />

      {/* 4. Floating Bottom Action Controls (matching iOS Calendar screenshot) */}
      <div className="absolute bottom-20 inset-x-0 px-4 flex items-center justify-between pointer-events-none z-30">
        {/* "Aujourd'hui" Return Pill */}
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

        {/* Task counter indicator */}
        <div className="pointer-events-auto bg-[#1F2228]/90 text-white font-semibold text-xs py-2 px-3.5 rounded-full shadow-2xl backdrop-blur-md border border-[#333742] flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-[#D4F63D]" />
          <span>{tasks.length} tâche{tasks.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Task Creation Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleCreateTask}
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
    </div>
  );
};
