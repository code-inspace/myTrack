"use client";

import React, { useState } from "react";
import { TasksHeaderWithNav } from "@/components/shared/TasksHeaderWithNav";
import { HistoryTaskCard } from "./HistoryTaskCard";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { TrendingUp, Inbox } from "lucide-react";

export const HistoryView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [editingTask, setEditingTask] = useState<TaskWithCompletion | null>(null);

  const { tasks, isLoading } = useTasks(selectedDate);
  const {
    updateTask,
    toggleCompletion,
    startTaskExecution,
    finishTaskExecution,
  } = useTaskMutations();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.isCompletedToday).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleUpdateTask = (values: TaskFormValues, taskId?: string) => {
    if (taskId) {
      updateTask.mutate({ taskId, values });
    }
    setEditingTask(null);
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen bg-[#0E0F12] relative overflow-hidden">
      {/* 1. Fixed Header Area */}
      <div className="flex-shrink-0 z-30 shadow-md">
        <TasksHeaderWithNav
          title="Mon Historique"
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-28 max-w-md mx-auto w-full">
        {/* Daily Summary Stats Card */}
        <div className="bg-[#16181D] border border-[#252830] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-[#8E929E] uppercase tracking-wider">
              Bilan de la journée
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">
                {completedTasks} / {totalTasks}
              </span>
              <span className="text-xs font-bold text-[#D4F63D]">
                ({completionPercentage}%)
              </span>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#D4F63D]/10 border border-[#D4F63D]/30 flex items-center justify-center text-[#D4F63D]">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Task List for the selected day */}
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full h-28 bg-[#1C1D22] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center bg-[#16181D] border border-[#252830] rounded-3xl my-2">
              <Inbox className="w-10 h-10 text-[#6B7280] mx-auto mb-2" />
              <h4 className="text-base font-bold text-white">Aucune tâche ce jour-là</h4>
              <p className="text-xs text-[#8E929E] mt-1">
                Aucune habitude programmée pour cette date.
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <HistoryTaskCard
                key={task.id}
                task={task}
                date={selectedDate}
                onStartTask={(taskId) => startTaskExecution.mutate({ taskId, date: selectedDate })}
                onFinishTask={(taskId) => finishTaskExecution.mutate({ taskId, date: selectedDate })}
                onToggleComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
                onEditTask={(t) => setEditingTask(t)}
              />
            ))
          )}
        </div>
      </div>

      {/* Task Edit Modal */}
      <TaskFormModal
        isOpen={Boolean(editingTask)}
        initialTask={editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdateTask}
      />
    </div>
  );
};
