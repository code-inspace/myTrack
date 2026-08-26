"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, TaskCompletion, TaskFormValues } from "../types";
import {
  createDbTask,
  updateDbTask,
  deleteDbTask,
  updateTaskSchedule,
  updateTaskSortOrder,
  moveTaskOccurrence,
  updateDbTaskStartedAt,
  getStoredTasks,
  getStoredCompletions,
  closeTaskAsCompleted,
  reopenTaskAsIncomplete,
  upsertDbCompletion,
  updateDbTaskActive,
  syncProjectStatusToDoneColumn,
} from "../actions";
import { useAuth } from "@/providers/AuthProvider";
import { getStoredProjects } from "@/features/projects/actions";
import { getProjectColumns, DEFAULT_PROJECT_COLUMNS } from "@/features/projects/types";
import { addHoursToTimeString, getTodayDateString } from "@/lib/dates";
import { format } from "date-fns";

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  // --- CRUD Mutations ---
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
              ...(values.enableReminders !== undefined
                ? { _enableReminders: values.enableReminders }
                : {}),
            },
          };
        }),
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
        old.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
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
        old.filter((t) => t.id !== deletedId),
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // --- Schedule & Reordering Mutations ---
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
        }),
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
        old.map((t) =>
          orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t,
        ),
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
    mutationFn: async ({
      taskId,
      fromDate,
      toDate,
    }: {
      taskId: string;
      fromDate: string;
      toDate: string;
    }) => {
      await moveTaskOccurrence(taskId, fromDate, toDate, userId);
    },
    onSuccess: () => {
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
      const [hours, minutes] = startedAtTime
        .split(":")
        .map((v) => parseInt(v, 10) || 0);
      const newStartDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
        0,
      );
      const newStartedAtIso = newStartDate.toISOString();

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) =>
          t.id === taskId ? { ...t, startedAt: newStartedAtIso } : t,
        ),
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

  // --- Completion Mutations ---
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
      const existing = completions.find(
        (c) => c.taskId === taskId && c.date === date,
      );
      const newStatus = existing ? !existing.completed : true;

      if (newStatus) {
        await closeTaskAsCompleted(taskId, date, userId, { value, duration });
        return;
      }
      await reopenTaskAsIncomplete(taskId, date, userId, { value, duration });
    },
    onMutate: async ({ taskId, date, value }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      await queryClient.cancelQueries({ queryKey: ["completions", userId] });

      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const prevCompletions = queryClient.getQueryData<TaskCompletion[]>([
        "completions",
        userId,
      ]);

      const completions = getStoredCompletions(userId);
      const existing = completions.find(
        (c) => c.taskId === taskId && c.date === date,
      );
      const newStatus = existing ? !existing.completed : true;

      // Optimistically update tasks: if task belongs to a project, update projectStatus
      const targetTask = prevTasks?.find((t) => t.id === taskId);
      if (targetTask?.projectId) {
        const projects = getStoredProjects(userId);
        const project = projects.find((p) => p.id === targetTask.projectId);
        const columns = project ? getProjectColumns(project) : DEFAULT_PROJECT_COLUMNS;
        const doneColumn =
          columns.find((c) => c.isDone) ||
          columns[columns.length - 1] ||
          DEFAULT_PROJECT_COLUMNS[DEFAULT_PROJECT_COLUMNS.length - 1];
        const firstColumn = columns[0] || DEFAULT_PROJECT_COLUMNS[0];

        const targetStatus = newStatus ? doneColumn.id : firstColumn.id;

        queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
          old.map((t) =>
            t.id === taskId ? { ...t, projectStatus: targetStatus } : t,
          ),
        );
      }

      // Optimistically update completions
      queryClient.setQueryData<TaskCompletion[]>(
        ["completions", userId],
        (old = []) => {
          const exists = old.some((c) => c.taskId === taskId && c.date === date);
          if (exists) {
            return old.map((c) =>
              c.taskId === taskId && c.date === date
                ? {
                    ...c,
                    completed: newStatus,
                    ...(value !== undefined ? { value } : {}),
                  }
                : c,
            );
          }
          return [
            {
              id: "comp-" + Date.now(),
              taskId,
              userId,
              date,
              completed: newStatus,
              value: value ?? null,
              duration: null,
              notes: null,
              scheduledStartTime: null,
              scheduledEndTime: null,
              actualStartTime: null,
              actualEndTime: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...old,
          ];
        },
      );

      return { prevTasks, prevCompletions };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
      if (context?.prevCompletions) {
        queryClient.setQueryData(
          ["completions", userId],
          context.prevCompletions,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const closeTask = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      await closeTaskAsCompleted(taskId, date, userId);
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);

      const targetTask = prevTasks?.find((t) => t.id === taskId);
      if (targetTask?.projectId) {
        const projects = getStoredProjects(userId);
        const project = projects.find((p) => p.id === targetTask.projectId);
        const columns = project ? getProjectColumns(project) : DEFAULT_PROJECT_COLUMNS;
        const doneColumn =
          columns.find((c) => c.isDone) ||
          columns[columns.length - 1] ||
          DEFAULT_PROJECT_COLUMNS[DEFAULT_PROJECT_COLUMNS.length - 1];

        queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
          old.map((t) =>
            t.id === taskId ? { ...t, projectStatus: doneColumn.id } : t,
          ),
        );
      }

      return { prevTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const reopenTask = useMutation({
    mutationFn: async ({
      taskId,
      date,
      skipProjectStatusReset,
    }: {
      taskId: string;
      date: string;
      skipProjectStatusReset?: boolean;
    }) => {
      await reopenTaskAsIncomplete(taskId, date, userId, {
        skipProjectStatusReset,
      });
    },
    onMutate: async ({ taskId, skipProjectStatusReset }) => {
      if (skipProjectStatusReset) return;

      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);

      const targetTask = prevTasks?.find((t) => t.id === taskId);
      if (targetTask?.projectId) {
        const projects = getStoredProjects(userId);
        const project = projects.find((p) => p.id === targetTask.projectId);
        const columns = project ? getProjectColumns(project) : DEFAULT_PROJECT_COLUMNS;
        const firstColumn = columns[0] || DEFAULT_PROJECT_COLUMNS[0];

        queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
          old.map((t) =>
            t.id === taskId ? { ...t, projectStatus: firstColumn.id } : t,
          ),
        );
      }

      return { prevTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

  // --- Execution / Active Timer Mutations ---
  const startTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const nowTime = format(new Date(), "HH:mm");
      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);
      const isRecurring =
        targetTask?.recurrence && targetTask.recurrence !== "ONCE";

      const provisionalEndTime =
        targetTask?.endTime || addHoursToTimeString(nowTime, 1);
      await updateTaskSchedule({
        taskId,
        date,
        startTime: nowTime,
        endTime: provisionalEndTime,
        applyToAll: !isRecurring,
        userId,
      });

      const completions = getStoredCompletions(userId);
      const existing = completions.find(
        (c) => c.taskId === taskId && c.date === date,
      );
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
      const isRecurring =
        targetTask?.recurrence && targetTask.recurrence !== "ONCE";

      let actualStart = nowTime;
      let durationMinutes = 1;

      if (targetTask?.startedAt) {
        const startDate = new Date(targetTask.startedAt);
        if (!isNaN(startDate.getTime())) {
          actualStart = format(startDate, "HH:mm");
          const diffMinutes = Math.round(
            (now.getTime() - startDate.getTime()) / 60000,
          );
          durationMinutes = Math.max(1, diffMinutes);
        }
      } else {
        const completions = getStoredCompletions(userId);
        const existing = completions.find(
          (c) => c.taskId === taskId && c.date === date,
        );
        if (existing?.actualStartTime) {
          actualStart = existing.actualStartTime;
        } else if (targetTask?.startTime) {
          actualStart = targetTask.startTime;
        }
      }

      await updateTaskSchedule({
        taskId,
        date,
        startTime: actualStart,
        endTime: nowTime,
        applyToAll: !isRecurring,
        userId,
      });

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

      await updateDbTaskActive(taskId, false, userId);
      await syncProjectStatusToDoneColumn(taskId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const toggleTaskActive = useMutation({
    mutationFn: async (args: string | { taskId: string; date?: string }) => {
      const taskId = typeof args === "string" ? args : args.taskId;
      const date =
        typeof args === "string"
          ? getTodayDateString()
          : args.date || getTodayDateString();

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

  return {
    createTask,
    updateTask,
    deleteTask,
    updateSchedule,
    reorderTasks,
    moveOccurrence,
    updateTaskStartedAt,
    toggleCompletion,
    closeTask,
    reopenTask,
    updateCompletionValue,
    startTaskExecution,
    finishTaskExecution,
    toggleTaskActive,
  };
}
