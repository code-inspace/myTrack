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
  updateDbTaskStartedAt,
  updateTaskSchedule,
  updateTaskSortOrder,
  moveTaskOccurrence,
  upsertDbCompletion,
  closeTaskAsCompleted,
  deleteDbTask,
  getStoredTasks,
  getStoredCompletions,
} from "./actions";
import { isTaskScheduledForDate, isOnceTaskCarriedOver, addHoursToTimeString, getTodayDateString } from "@/lib/dates";
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

  const { data: allTasks = getStoredTasks(userId) } = useQuery({
    queryKey: ["tasks", userId],
    queryFn: async () => fetchTasks(userId),
    initialData: () => getStoredTasks(userId),
    staleTime: 1000 * 30,
  });

  const { data: allCompletions = getStoredCompletions(userId) } = useQuery({
    queryKey: ["completions", userId],
    queryFn: async () => fetchCompletions(userId),
    initialData: () => getStoredCompletions(userId),
    staleTime: 1000 * 30,
  });

  const selectedDate = parseISO(selectedDateStr);
  const todayStr = getTodayDateString();

  // Filter tasks scheduled for the selected date
  const filteredTasks: TaskWithCompletion[] = allTasks
    .filter((task) => !task.isArchived)
    .filter((task) => {
      const scheduled = isTaskScheduledForDate(
        task.recurrence,
        task.recurrenceConfig,
        selectedDate,
        task.createdAt,
        task.dateOverrides
      );
      if (scheduled) return true;

      // Uncompleted one-shot tasks carry over to the next day(s) instead of disappearing
      if (task.recurrence === "ONCE") {
        const originalDate = task.createdAt ? task.createdAt.split("T")[0] : null;
        const hasBeenCompleted = allCompletions.some((c) => c.taskId === task.id && c.completed);
        return isOnceTaskCarriedOver(originalDate, selectedDateStr, todayStr, hasBeenCompleted);
      }

      return false;
    })
    .map((task) => mapTaskWithCompletion(task, allCompletions, selectedDateStr));

  const sortedTasks = sortTasksByPriority(filteredTasks);
  const activeTask = allTasks.find((t) => t.isActive && !t.isArchived);

  return {
    tasks: sortedTasks,
    allTasks,
    allCompletions,
    activeTask,
    isLoading: false,
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
        projectId: values.projectId || null,
        projectStatus: values.projectStatus || null,
        enableReminders: values.enableReminders,
        reminderOffsetMinutes: values.reminderOffsetMinutes,
        reminderTimes: values.reminderTimes,
        // `date` isn't part of the Task model (recurring tasks have no fixed date) — createDbTask
        // reads it off as an untyped override to seed a ONCE task's initial scheduled date.
        ...(values.date ? { date: values.date } : {}),
      } as Omit<Task, "id" | "createdAt" | "updatedAt"> & { date?: string });
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

  const reorderTasks = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await updateTaskSortOrder(taskIds, userId);
    },
    onMutate: async (taskIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const orderMap = new Map(taskIds.map((id, index) => [id, index]));

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) => (orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t))
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

  const moveOccurrence = useMutation({
    mutationFn: async ({ taskId, fromDate, toDate }: { taskId: string; fromDate: string; toDate: string }) => {
      await moveTaskOccurrence(taskId, fromDate, toDate, userId);
    },
    onSuccess: () => {
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

      if (newStatus) {
        // Closing a task that was never started (no actualStartTime yet) defaults to a
        // 30-minute block ending now, instead of a zero-duration now-to-now entry, and
        // reflects that window on the task's own schedule so it shows up in the Agenda.
        await closeTaskAsCompleted(taskId, date, userId, { value, duration });
        return;
      }

      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);

      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: false,
        value: value !== undefined ? value : existing?.value || null,
        duration: duration !== undefined ? duration : existing?.duration || null,
        scheduledStartTime: targetTask?.startTime || existing?.scheduledStartTime || null,
        scheduledEndTime: targetTask?.endTime || existing?.scheduledEndTime || null,
        actualStartTime: existing?.actualStartTime || null,
        actualEndTime: null,
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Explicitly marks a task as completed "now" (idempotent) — used e.g. by dropping a
  // Kanban card onto a project's "done" column.
  const closeTask = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      await closeTaskAsCompleted(taskId, date, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const startTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const nowTime = format(new Date(), "HH:mm");
      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);
      const isRecurring = targetTask?.recurrence && targetTask.recurrence !== "ONCE";

      // 1. Position task on the Agenda starting at now
      const provisionalEndTime = targetTask?.endTime || addHoursToTimeString(nowTime, 1);
      await updateTaskSchedule({
        taskId,
        date,
        startTime: nowTime,
        endTime: provisionalEndTime,
        applyToAll: !isRecurring,
        userId,
      });

      // 2. Set actual_start_time = now in completions
      const completions = getStoredCompletions(userId);
      const existing = completions.find((c) => c.taskId === taskId && c.date === date);
      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: existing?.completed || false,
        scheduledStartTime: nowTime,
        scheduledEndTime: provisionalEndTime,
        actualStartTime: nowTime,
        actualEndTime: existing?.actualEndTime || null,
      });

      // 3. Mark task active
      await updateDbTaskActive(taskId, true, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const finishTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const now = new Date();
      const nowTime = format(now, "HH:mm");
      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);
      const isRecurring = targetTask?.recurrence && targetTask.recurrence !== "ONCE";

      let actualStart = nowTime;
      let durationMinutes = 1;

      if (targetTask?.startedAt) {
        const startDate = new Date(targetTask.startedAt);
        if (!isNaN(startDate.getTime())) {
          actualStart = format(startDate, "HH:mm");
          const diffMinutes = Math.round((now.getTime() - startDate.getTime()) / 60000);
          durationMinutes = Math.max(1, diffMinutes);
        }
      } else {
        const completions = getStoredCompletions(userId);
        const existing = completions.find((c) => c.taskId === taskId && c.date === date);
        if (existing?.actualStartTime) {
          actualStart = existing.actualStartTime;
        } else if (targetTask?.startTime) {
          actualStart = targetTask.startTime;
        }
      }

      // 1. Set task endTime to now on the Agenda
      await updateTaskSchedule({
        taskId,
        date,
        startTime: actualStart,
        endTime: nowTime,
        applyToAll: !isRecurring,
        userId,
      });

      // 2. Mark completed: true and actualEndTime: now in task_completions
      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: true,
        duration: durationMinutes,
        actualStartTime: actualStart,
        actualEndTime: nowTime,
        scheduledStartTime: actualStart,
        scheduledEndTime: nowTime,
      });

      // 3. Deactivate task
      await updateDbTaskActive(taskId, false, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const toggleTaskActive = useMutation({
    mutationFn: async (args: string | { taskId: string; date?: string }) => {
      const taskId = typeof args === "string" ? args : args.taskId;
      const date = typeof args === "string" ? getTodayDateString() : (args.date || getTodayDateString());

      const tasks = getStoredTasks(userId);
      const target = tasks.find((t) => t.id === taskId);
      const isCurrentlyActive = Boolean(target?.isActive);

      if (!isCurrentlyActive) {
        await startTaskExecution.mutateAsync({ taskId, date });
      } else {
        await finishTaskExecution.mutateAsync({ taskId, date });
      }
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
    onMutate: async ({ taskId, values }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            ...values,
            dateOverrides: {
              ...(t.dateOverrides || {}),
              ...(values.enableReminders !== undefined ? { _enableReminders: values.enableReminders } : {}),
            },
          };
        })
      );

      return { prevTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
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

  const updateTaskStartedAt = useMutation({
    mutationFn: async ({
      taskId,
      startedAtTime,
    }: {
      taskId: string;
      startedAtTime: string;
    }) => {
      return updateDbTaskStartedAt(taskId, startedAtTime, userId);
    },
    onMutate: async ({ taskId, startedAtTime }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);

      const now = new Date();
      const [hours, minutes] = startedAtTime.split(":").map((v) => parseInt(v, 10) || 0);
      const newStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
      const newStartedAtIso = newStartDate.toISOString();

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, startedAt: newStartedAtIso } : t))
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
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  return {
    createTask,
    updateTask,
    toggleTaskActive,
    updateSchedule,
    reorderTasks,
    moveOccurrence,
    toggleCompletion,
    closeTask,
    startTaskExecution,
    finishTaskExecution,
    updateCompletionValue,
    updateTaskStartedAt,
    deleteTask,
  };
}
