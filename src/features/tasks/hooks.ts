"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, TaskCompletion, TaskFormValues, TaskWithCompletion } from "./types";
import {
  fetchTasks,
  fetchCompletions,
  createDbTask,
  updateDbTask,
  updateDbTaskActive,
  updateTaskSchedule,
  upsertDbCompletion,
  deleteDbTask,
  getStoredTasks,
  getStoredCompletions,
} from "./actions";
import { isTaskScheduledForDate } from "@/lib/dates";
import { mapTaskWithCompletion, sortTasksByPriority } from "./mappers";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { parseISO, format } from "date-fns";

export function useTasks(selectedDateStr: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  // Supabase Realtime Listener across devices
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-tasks-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_completions", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["completions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["tasks", userId],
    queryFn: async () => fetchTasks(userId),
    staleTime: 1000 * 5,
  });

  const { data: allCompletions = [], isLoading: isLoadingCompletions } = useQuery({
    queryKey: ["completions", userId],
    queryFn: async () => fetchCompletions(userId),
    staleTime: 1000 * 5,
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
      const targetUserId = values.userId || userId;
      return createDbTask({
        userId: targetUserId,
        title: values.title,
        description: values.description || null,
        category: values.category || "General",
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        recurrence: values.recurrence || "DAILY",
        recurrenceConfig: values.recurrenceConfig || null,
        dateOverrides: {},
        trackingType: values.trackingType || "BOOLEAN",
        targetValue: values.targetValue || null,
        unit: values.unit || null,
        isActive: false,
        isArchived: false,
      });
    },
    onSuccess: (newTask) => {
      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) => [
        newTask,
        ...old.filter((t) => t.id !== newTask.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
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
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async ({
      taskId,
      date,
      startTime,
      endTime,
      applyToAll,
    }: {
      taskId: string;
      date: string;
      startTime: string | null;
      endTime: string | null;
      applyToAll?: boolean;
    }) => {
      await updateTaskSchedule({
        taskId,
        date,
        startTime,
        endTime,
        applyToAll,
        userId,
      });
    },
    onMutate: async ({ taskId, date, startTime, endTime, applyToAll }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          const isRecurring = t.recurrence && t.recurrence !== "ONCE";
          if (isRecurring && !applyToAll) {
            return {
              ...t,
              dateOverrides: {
                ...(t.dateOverrides || {}),
                [date]: { startTime, endTime },
              },
            };
          }
          return { ...t, startTime, endTime };
        })
      );

      return { prevTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);
      const nowTime = format(new Date(), "HH:mm");

      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: newStatus,
        value: value !== undefined ? value : existing?.value || null,
        duration: duration !== undefined ? duration : existing?.duration || null,
        scheduledStartTime: targetTask?.startTime || existing?.scheduledStartTime || null,
        scheduledEndTime: targetTask?.endTime || existing?.scheduledEndTime || null,
        actualStartTime: existing?.actualStartTime || (newStatus ? nowTime : null),
        actualEndTime: newStatus ? nowTime : null,
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const startTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const completions = getStoredCompletions(userId);
      const existing = completions.find((c) => c.taskId === taskId && c.date === date);
      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);
      const nowTime = format(new Date(), "HH:mm");

      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: existing?.completed || false,
        scheduledStartTime: targetTask?.startTime || null,
        scheduledEndTime: targetTask?.endTime || null,
        actualStartTime: nowTime,
        actualEndTime: existing?.actualEndTime || null,
      });

      // Also set task active
      await updateDbTaskActive(taskId, true, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const finishTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const completions = getStoredCompletions(userId);
      const existing = completions.find((c) => c.taskId === taskId && c.date === date);
      const nowTime = format(new Date(), "HH:mm");

      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: true,
        actualEndTime: nowTime,
      });

      // Deactivate timer
      await updateDbTaskActive(taskId, false, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
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
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({
      taskId,
      values,
    }: {
      taskId: string;
      values: Partial<TaskFormValues>;
    }) => {
      return updateDbTask(taskId, values, userId);
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      await deleteDbTask(taskId, userId);
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.filter((t) => t.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return {
    createTask,
    updateTask,
    toggleTaskActive,
    updateSchedule,
    toggleCompletion,
    startTaskExecution,
    finishTaskExecution,
    updateCompletionValue,
    deleteTask,
  };
}
