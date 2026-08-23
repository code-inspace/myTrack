"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taskQueryKeys } from "./queries";
import { Task, TaskCompletion, TaskFormValues, TaskWithCompletion } from "./types";
import {
  fetchTasks,
  fetchCompletions,
  createDbTask,
  updateDbTaskActive,
  upsertDbCompletion,
  deleteDbTask,
  getStoredTasks,
  getStoredCompletions,
} from "./actions";
import { isTaskScheduledForDate } from "@/lib/dates";
import { mapTaskWithCompletion, sortTasksByPriority } from "./mappers";
import { useAuth } from "@/providers/AuthProvider";
import { parseISO } from "date-fns";

export function useTasks(selectedDateStr: string) {
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: [...taskQueryKeys.all, userId],
    queryFn: async () => fetchTasks(userId),
  });

  const { data: allCompletions = [], isLoading: isLoadingCompletions } = useQuery({
    queryKey: [...taskQueryKeys.completions(), userId],
    queryFn: async () => fetchCompletions(userId),
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
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  const createTask = useMutation({
    mutationFn: async (values: TaskFormValues & { userId?: string }) => {
      return createDbTask({
        userId: values.userId || userId,
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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });

  const toggleTaskActive = useMutation({
    mutationFn: async (taskId: string) => {
      const tasks = getStoredTasks(userId);
      const target = tasks.find((t) => t.id === taskId);
      const isCurrentlyActive = Boolean(target?.isActive);
      await updateDbTaskActive(taskId, !isCurrentlyActive, userId);
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
      const completions = getStoredCompletions(userId);
      const existing = completions.find((c) => c.taskId === taskId && c.date === date);
      const newStatus = existing ? !existing.completed : true;

      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: newStatus,
        value: value !== undefined ? value : existing?.value || null,
        duration: duration !== undefined ? duration : existing?.duration || null,
        notes: null,
      });
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
      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: true,
        value,
        duration: null,
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.completions() });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      await deleteDbTask(taskId, userId);
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
