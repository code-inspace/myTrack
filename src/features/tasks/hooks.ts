"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taskQueryKeys } from "./queries";
import { Task, TaskCompletion, TaskFormValues, TaskWithCompletion } from "./types";
import {
  getStoredTasks,
  saveStoredTasks,
  getStoredCompletions,
  saveStoredCompletions,
} from "./actions";
import { isTaskScheduledForDate } from "@/lib/dates";
import { mapTaskWithCompletion, sortTasksByPriority } from "./mappers";
import { parseISO } from "date-fns";

export function useTasks(selectedDateStr: string) {
  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: taskQueryKeys.all,
    queryFn: async () => getStoredTasks(),
  });

  const { data: allCompletions = [], isLoading: isLoadingCompletions } = useQuery({
    queryKey: taskQueryKeys.completions(),
    queryFn: async () => getStoredCompletions(),
  });

  const selectedDate = parseISO(selectedDateStr);

  // Filter tasks scheduled for the selected date
  const filteredTasks: TaskWithCompletion[] = allTasks
    .filter((task) => !task.isArchived)
    .filter((task) =>
      isTaskScheduledForDate(task.recurrence, task.recurrenceConfig, selectedDate, task.createdAt)
    )
    .map((task) => mapTaskWithCompletion(task, allCompletions, selectedDateStr));

  const sortedTasks = sortTasksByPriority(filteredTasks);
  const activeTask = allTasks.find((t) => t.isActive && !t.isArchived);

  return {
    tasks: sortedTasks,
    allTasks,
    allCompletions,
    activeTask,
    isLoading: isLoadingTasks || isLoadingCompletions,
  };
}

export function useTaskMutations() {
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: async (values: TaskFormValues & { userId?: string }) => {
      const tasks = getStoredTasks();
      const newTask: Task = {
        id: "task-" + Date.now(),
        userId: values.userId || "user-demo",
        title: values.title,
        description: values.description || null,
        category: values.category || "General",
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        recurrence: values.recurrence,
        recurrenceConfig: values.recurrenceConfig || null,
        trackingType: values.trackingType,
        targetValue: values.targetValue || null,
        unit: values.unit || null,
        isActive: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated = [newTask, ...tasks];
      saveStoredTasks(updated);
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });

  const toggleTaskActive = useMutation({
    mutationFn: async (taskId: string) => {
      const tasks = getStoredTasks();
      const target = tasks.find((t) => t.id === taskId);
      const isCurrentlyActive = target?.isActive;

      // If making active, deactivate all others first (only 1 active task at a time)
      const updated = tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, isActive: !isCurrentlyActive, updatedAt: new Date().toISOString() };
        }
        return { ...t, isActive: false };
      });

      saveStoredTasks(updated);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });

  const toggleCompletion = useMutation({
    mutationFn: async ({
      taskId,
      date,
      value,
      duration,
    }: {
      taskId: string;
      date: string;
      value?: number | null;
      duration?: number | null;
    }) => {
      const completions = getStoredCompletions();
      const existingIndex = completions.findIndex(
        (c) => c.taskId === taskId && c.date === date
      );

      let updatedCompletions: TaskCompletion[];

      if (existingIndex >= 0) {
        const existing = completions[existingIndex];
        const newStatus = !existing.completed;
        updatedCompletions = [...completions];
        updatedCompletions[existingIndex] = {
          ...existing,
          completed: newStatus,
          value: value !== undefined ? value : existing.value,
          duration: duration !== undefined ? duration : existing.duration,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const newCompletion: TaskCompletion = {
          id: "comp-" + Date.now(),
          taskId,
          userId: "user-demo",
          date,
          completed: true,
          value: value || null,
          duration: duration || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updatedCompletions = [newCompletion, ...completions];
      }

      saveStoredCompletions(updatedCompletions);
      return updatedCompletions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.completions() });
    },
  });

  const updateCompletionValue = useMutation({
    mutationFn: async ({
      taskId,
      date,
      value,
    }: {
      taskId: string;
      date: string;
      value: number;
    }) => {
      const completions = getStoredCompletions();
      const existingIndex = completions.findIndex(
        (c) => c.taskId === taskId && c.date === date
      );

      let updated: TaskCompletion[];
      if (existingIndex >= 0) {
        updated = [...completions];
        updated[existingIndex] = {
          ...updated[existingIndex],
          value,
          completed: true,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const newComp: TaskCompletion = {
          id: "comp-" + Date.now(),
          taskId,
          userId: "user-demo",
          date,
          completed: true,
          value,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updated = [newComp, ...completions];
      }
      saveStoredCompletions(updated);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.completions() });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const tasks = getStoredTasks();
      const updated = tasks.filter((t) => t.id !== taskId);
      saveStoredTasks(updated);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });

  return {
    createTask,
    toggleTaskActive,
    toggleCompletion,
    updateCompletionValue,
    deleteTask,
  };
}
