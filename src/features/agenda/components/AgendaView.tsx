"use client";

import React, { useState } from "react";
import { TasksHeaderWithNav } from "@/components/shared/TasksHeaderWithNav";
import { AgendaTimeline } from "./AgendaTimeline";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { QuantityLoggingModal } from "@/features/tasks/components/QuantityLoggingModal";
import { VoiceFab } from "@/features/voice/components/VoiceFab";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

import { useSelectedDate } from "@/providers/DateProvider";

export const AgendaView: React.FC = () => {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const todayStr = getTodayDateString();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithCompletion | null>(null);
  const [selectedLoggingTask, setSelectedLoggingTask] = useState<TaskWithCompletion | null>(null);

  const { tasks, allTasks, allCompletions, isLoading } = useTasks(selectedDate);
  const {
    createTask,
    updateTask,
    updateSchedule,
    toggleCompletion,
    updateCompletionValue,
    deleteTask,
  } = useTaskMutations();

  const handleDragStartTask = (e: React.DragEvent, task: TaskWithCompletion) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.setData("taskId", task.id);
  };

  const handleMoveTaskToTime = (taskId: string, startTime: string, endTime: string, date?: string) => {
    const targetDate = date || selectedDate;
    const task = allTasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: targetDate,
      startTime,
      endTime,
      applyToAll: !isRecurring,
    });
  };

  const handleDropToAllDay = (taskId: string, date?: string) => {
    const targetDate = date || selectedDate;
    const task = allTasks.find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    const isRecurring = task?.recurrence && task.recurrence !== "ONCE";

    updateSchedule.mutate({
      taskId,
      date: targetDate,
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
    <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-[#0E0F12] relative overflow-hidden">
      {/* 1. Fixed Header Area: TasksHeaderWithNav */}
      <div className="flex-shrink-0 z-30 shadow-md">
        <TasksHeaderWithNav
          title="Mon Agenda"
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* 2. Scrollable Hourly Timeline Area with Integrated Multi-Day & All-Day Filter */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
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
      <VoiceFab selectedDate={selectedDate} allTasks={allTasks} />
    </div>
  );
};
