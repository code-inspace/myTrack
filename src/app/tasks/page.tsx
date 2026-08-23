"use client";

import React, { useState } from "react";
import { TasksHeaderWithNav } from "@/components/shared/TasksHeaderWithNav";
import { ActiveTaskBanner } from "@/features/tasks/components/ActiveTaskBanner";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { QuantityLoggingModal } from "@/features/tasks/components/QuantityLoggingModal";
import { InteractiveNotificationSheet } from "@/features/notifications/components/InteractiveNotificationSheet";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { Plus, CheckCircle2, Sparkles, Inbox } from "lucide-react";

import { sendNativeNotification } from "@/lib/notifications/service";

import { NotificationPermissionButton } from "@/features/notifications/components/NotificationPermissionButton";

export default function TasksPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedLoggingTask, setSelectedLoggingTask] = useState<TaskWithCompletion | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [isTestNotificationOpen, setIsTestNotificationOpen] = useState(false);

  const { tasks, activeTask, isLoading } = useTasks(selectedDate);
  const [editingTask, setEditingTask] = useState<TaskWithCompletion | null>(null);

  const {
    createTask,
    updateTask,
    toggleTaskActive,
    updateSchedule,
    toggleCompletion,
    updateCompletionValue,
    deleteTask,
  } = useTaskMutations();

  // Active task object mapped
  const activeTaskMapped = tasks.find((t) => t.id === activeTask?.id);

  const handleOpenNotificationTest = async () => {
    setIsTestNotificationOpen(true);
    await sendNativeNotification({
      title: "MyTrack • Rappel interactif",
      body: "As-tu réalisé tes objectifs aujourd'hui ? 🎯",
      tag: "mytrack-header-test",
    });
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    createTask.mutate({
      title: quickTitle.trim(),
      category: "General",
      trackingType: "BOOLEAN",
      recurrence: "DAILY",
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

  return (
    <div className="flex-1 flex flex-col pb-24">
      {/* Unified Top Header & Switcher */}
      <TasksHeaderWithNav
        title="Mes Habitudes"
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenNotifications={handleOpenNotificationTest}
      />

      {/* Main Content Area */}
      <div className="px-4 mt-3 space-y-3.5 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-white tracking-tight">Aujourd'hui</h2>
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center gap-1 text-xs font-bold text-[#D4F63D] hover:underline cursor-pointer bg-[#1C1D22] px-3 py-1.5 rounded-full border border-[#282A30]"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle tâche
          </button>
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

        {/* Active Task Banner */}
        {activeTaskMapped && (
          <ActiveTaskBanner
            task={activeTaskMapped}
            onStop={(taskId) => toggleTaskActive.mutate(taskId)}
            onComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
            onOpenLogModal={(t) => setSelectedLoggingTask(t)}
          />
        )}

        {/* Tasks List */}
        <div className="space-y-2.5 pt-1">
          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full h-18 rounded-2xl bg-[#1C1D22] animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center bg-[#1C1D22] border border-[#282A30] rounded-3xl my-4">
              <Inbox className="w-10 h-10 text-[#6B7280] mx-auto mb-2" />
              <h4 className="text-base font-bold text-white">Aucune tâche programmée</h4>
              <p className="text-xs text-[#8E929E] mt-1 mb-4">
                Tu n'as aucune habitude active pour cette date.
              </p>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-4 py-2 rounded-full bg-[#D4F63D] text-black font-bold text-xs"
              >
                Créer ta première tâche
              </button>
            </div>
          ) : (
            tasks
              .filter((task) => !task.isActive)
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleActive={(id) => toggleTaskActive.mutate(id)}
                  onToggleComplete={(id) => toggleCompletion.mutate({ taskId: id, date: selectedDate })}
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
    </div>
  );
}
