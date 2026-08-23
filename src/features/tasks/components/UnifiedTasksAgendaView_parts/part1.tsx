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
import { DailyBilanView } from "@/features/sleep/components/DailyBilanView";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { TaskWithCompletion, TaskFormValues } from "@/features/tasks/types";
import { getTodayDateString } from "@/lib/dates";
import { CheckCircle2, Inbox, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnifiedTasksAgendaViewProps {
  initialTab?: "habits" | "agenda" | "sleep" | "bilan";
}

export const UnifiedTasksAgendaView: React.FC<UnifiedTasksAgendaViewProps> = ({
  initialTab = "habits",
}) => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<"habits" | "agenda" | "sleep" | "bilan">(initialTab);

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

  const handleTabChange = (tab: "habits" | "agenda" | "sleep" | "bilan") => {
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
          : "/tasks"
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen bg-[#0E0F12] relative overflow-hidden">
      {/* 1. Permanent Fixed Header Area: zero reload / zero unmount */}
      <div className="flex-shrink-0 z-30 shadow-md">
        <TasksHeaderWithNav