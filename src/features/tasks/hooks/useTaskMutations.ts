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
import { format, addMinutes } from "date-fns";
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { cancelTaskPushNotifications } from "@/lib/onesignal/client";

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "";

  // --- CRUD Mutations ---
  const createTask = useMutation({
    mutationFn: async (
      values: TaskFormValues & { userId?: string; autoStart?: boolean },
    ) => {
      const targetUserId = values.userId || userId;
      const now = new Date();
      const nowIso = now.toISOString();
      const nowTime = format(now, "HH:mm");
      const isAutoStart = Boolean(values.autoStart);
      const taskDate = values.date || getTodayDateString();

      const created = await createDbTask({
        userId: targetUserId,
        title: values.title,
        description: values.description || null,
        category: values.category || "General",
        startTime: values.startTime || (isAutoStart ? nowTime : null),
        endTime: values.endTime || null,
        recurrence: values.recurrence || "ONCE",
        recurrenceConfig: values.recurrenceConfig || null,
        dateOverrides: {},
        trackingType: values.trackingType || "BOOLEAN",
        targetValue: values.targetValue || null,
        unit: values.unit || null,
        isActive: isAutoStart,
        startedAt: isAutoStart ? nowIso : null,
        isArchived: false,
        projectId: values.projectId || null,
        projectStatus: values.projectStatus || null,
        enableReminders: values.enableReminders,
        reminderOffsetMinutes: values.reminderOffsetMinutes,
        reminderTimes: values.reminderTimes,
        date: taskDate,
      } as Omit<Task, "id" | "createdAt" | "updatedAt"> & { date?: string });

      if (isAutoStart) {
        const duration = (created.targetValue as number) || 30;
        const provisionalEndTime = format(addMinutes(now, duration), "HH:mm");

        try {
          await updateTaskSchedule({
            taskId: created.id,
            date: taskDate,
            startTime: nowTime,
            endTime: provisionalEndTime,
            applyToAll: created.recurrence === "ONCE",
            userId: targetUserId,
          });
        } catch (err) {
          console.warn("createTask autoStart updateTaskSchedule error:", err);
        }

        try {
          await upsertDbCompletion({
            taskId: created.id,
            userId: targetUserId,
            date: taskDate,
            completed: false,
            scheduledStartTime: nowTime,
            scheduledEndTime: provisionalEndTime,
            actualStartTime: nowTime,
            actualEndTime: null,
          });
        } catch (err) {
          console.warn("createTask autoStart upsertDbCompletion error:", err);
        }

        try {
          const _projects = getStoredProjects(targetUserId);
          const _project = created.projectId ? _projects.find((p) => p.id === created.projectId) : null;
          await LiveActivityBridge.startActivity(
            {
              taskId: created.id,
              taskTitle: created.title,
              category: created.category,
              projectColor: _project?.color,
              projectName: _project?.name,
            },
            {
              currentStatus: "IN_PROGRESS",
              startedAtTimestamp: Math.floor(Date.now() / 1000),
              elapsedSeconds: 0,
              targetDurationSeconds: ((created.targetValue || 30) as number) * 60,
              totalFormattedDuration: `${created.targetValue || 30} min`,
              subtitle: created.category || "En cours",
              progress: 0,
            },
          );
        } catch {}
      }

      return created;
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", userId]) || [];
      const taskDate = values.date || getTodayDateString();
      const tempId = "temp-" + Date.now();
      const optimisticTask: Task = {
        id: tempId,
        userId: values.userId || userId,
        title: values.title,
        description: values.description || null,
        category: values.category || "General",
        tag: values.category || "General",
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        recurrence: values.recurrence || "ONCE",
        recurrenceConfig: values.recurrenceConfig || null,
        dateOverrides: {},
        trackingType: values.trackingType || "BOOLEAN",
        targetValue: values.targetValue || null,
        unit: values.unit || null,
        isActive: Boolean(values.autoStart),
        startedAt: values.autoStart ? new Date().toISOString() : null,
        isArchived: false,
        projectId: values.projectId || null,
        projectStatus: values.projectStatus || null,
        enableReminders: values.enableReminders,
        reminderOffsetMinutes: values.reminderOffsetMinutes,
        reminderTimes: values.reminderTimes,
        createdAt: `${taskDate}T12:00:00.000Z`,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Task[]>(["tasks", userId], [optimisticTask, ...previousTasks]);
      return { previousTasks, tempId };
    },
    onError: (_err, _newVal, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", userId], context.previousTasks);
      }
    },
    onSuccess: (newTask, _variables, context) => {
      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) => [
        newTask,
        ...old.filter((t) => t.id !== newTask.id && t.id !== context?.tempId),
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
      await queryClient.cancelQueries({ queryKey: ["completions", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const prevCompletions = queryClient.getQueryData<TaskCompletion[]>([
        "completions",
        userId,
      ]);

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          const isChangingProject = values.projectId !== undefined && values.projectId !== t.projectId;
          const nextProjectId = values.projectId !== undefined ? (values.projectId || null) : (t.projectId || null);
          const nextProjectCategory = nextProjectId
            ? isChangingProject
              ? (values.projectCategory || null)
              : (values.projectCategory !== undefined ? (values.projectCategory || null) : (t.projectCategory || null))
            : null;
          const nextProjectStatus = nextProjectId
            ? isChangingProject
              ? (values.projectStatus || "TODO")
              : (values.projectStatus !== undefined ? (values.projectStatus || "TODO") : (t.projectStatus || "TODO"))
            : null;

          return {
            ...t,
            ...values,
            projectId: nextProjectId,
            projectStatus: nextProjectStatus,
            projectCategory: nextProjectCategory,
            ...(values.date ? { createdAt: `${values.date}T12:00:00.000Z` } : {}),
            dateOverrides: {
              ...(t.dateOverrides || {}),
              ...(values.enableReminders !== undefined
                ? { _enableReminders: values.enableReminders }
                : {}),
              _projectCategory: nextProjectCategory,
              ...(values.isNoProject !== undefined
                ? { _isNoProject: values.isNoProject }
                : (nextProjectId ? { _isNoProject: false } : { _isNoProject: true })),
            },
          };
        }),
      );

      if (values.startTime !== undefined || values.endTime !== undefined) {
        queryClient.setQueryData<TaskCompletion[]>(
          ["completions", userId],
          (old = []) =>
            old.map((c) => {
              if (c.taskId === taskId && (!values.date || c.date === values.date)) {
                return {
                  ...c,
                  scheduledStartTime: values.startTime !== undefined ? values.startTime : c.scheduledStartTime,
                  scheduledEndTime: values.endTime !== undefined ? values.endTime : c.scheduledEndTime,
                  actualStartTime: c.completed
                    ? (values.startTime !== undefined ? values.startTime : c.actualStartTime)
                    : (c.actualStartTime ? (values.startTime !== undefined ? values.startTime : c.actualStartTime) : null),
                  actualEndTime: c.completed
                    ? (values.endTime !== undefined ? values.endTime : c.actualEndTime)
                    : (c.actualEndTime ? (values.endTime !== undefined ? values.endTime : c.actualEndTime) : null),
                };
              }
              return c;
            }),
        );
      }

      return { prevTasks, prevCompletions };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
      if (context?.prevCompletions) {
        queryClient.setQueryData(["completions", userId], context.prevCompletions);
      }
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.some((t) => t.id === updatedTask.id)
          ? old.map((t) => (t.id === updatedTask.id ? updatedTask : t))
          : old,
      );
      queryClient.setQueryData<Task[]>(["tasks"], (old = []) =>
        Array.isArray(old) && old.some((t) => t.id === updatedTask.id)
          ? old.map((t) => (t.id === updatedTask.id ? updatedTask : t))
          : old,
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      cancelTaskPushNotifications({ taskId, userId }).catch(() => {});
      await deleteDbTask(taskId, userId);
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      await queryClient.cancelQueries({ queryKey: ["completions", userId] });
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["completions"] });

      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const prevCompletions = queryClient.getQueryData<TaskCompletion[]>([
        "completions",
        userId,
      ]);

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.filter((t) => t.id !== deletedId),
      );
      queryClient.setQueryData<Task[]>(["tasks"], (old = []) =>
        Array.isArray(old) ? old.filter((t) => t.id !== deletedId) : old,
      );
      queryClient.setQueryData<TaskCompletion[]>(["completions", userId], (old = []) =>
        old.filter((c) => c.taskId !== deletedId),
      );
      queryClient.setQueryData<TaskCompletion[]>(["completions"], (old = []) =>
        Array.isArray(old) ? old.filter((c) => c.taskId !== deletedId) : old,
      );

      return { prevTasks, prevCompletions };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
      if (context?.prevCompletions) {
        queryClient.setQueryData(["completions", userId], context.prevCompletions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
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
      await queryClient.cancelQueries({ queryKey: ["completions", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const prevCompletions = queryClient.getQueryData<TaskCompletion[]>([
        "completions",
        userId,
      ]);

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

      queryClient.setQueryData<TaskCompletion[]>(
        ["completions", userId],
        (old = []) =>
          old.map((c) => {
            if (c.taskId === taskId && (applyToAll || c.date === date)) {
              return {
                ...c,
                scheduledStartTime: startTime ?? c.scheduledStartTime,
                scheduledEndTime: endTime ?? c.scheduledEndTime,
                actualStartTime: c.completed
                  ? (startTime ?? c.actualStartTime)
                  : (c.actualStartTime ? (startTime ?? c.actualStartTime) : null),
                actualEndTime: c.completed
                  ? (endTime ?? c.actualEndTime)
                  : (c.actualEndTime ? (endTime ?? c.actualEndTime) : null),
              };
            }
            return c;
          }),
      );

      return { prevTasks, prevCompletions };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
      if (context?.prevCompletions) {
        queryClient.setQueryData(["completions", userId], context.prevCompletions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
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
      } else {
        await reopenTaskAsIncomplete(taskId, date, userId, { value, duration });
      }
    },
    onMutate: async ({ taskId, date, value }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      await queryClient.cancelQueries({ queryKey: ["completions", userId] });

      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const prevCompletions = queryClient.getQueryData<TaskCompletion[]>([
        "completions",
        userId,
      ]);

      const completions = prevCompletions || getStoredCompletions(userId);
      const existing = completions.find(
        (c) => c.taskId === taskId && c.date === date,
      );
      const newStatus = existing ? !existing.completed : true;

      // Optimistically update tasks: update projectStatus
      const targetTask = prevTasks?.find((t) => t.id === taskId);
      if (targetTask) {
        if (targetTask.projectId) {
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
        } else {
          const targetStatus = newStatus ? "DONE" : "TODO";
          queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
            old.map((t) =>
              t.id === taskId ? { ...t, projectStatus: targetStatus } : t,
            ),
          );
        }
      }

      // Optimistically update completions
      const nextCompletions = (() => {
        const current = prevCompletions || getStoredCompletions(userId);
        const exists = current.some((c) => c.taskId === taskId && c.date === date);
        if (exists) {
          return current.map((c) =>
            c.taskId === taskId && c.date === date
              ? {
                  ...c,
                  completed: newStatus,
                  ...(value !== undefined ? { value } : {}),
                }
              : c,
          );
        }
        const effectiveStart =
          targetTask?.dateOverrides?.[date]?.startTime !== undefined
            ? targetTask.dateOverrides[date].startTime
            : targetTask?.startTime || null;
        const effectiveEnd =
          targetTask?.dateOverrides?.[date]?.endTime !== undefined
            ? targetTask.dateOverrides[date].endTime
            : targetTask?.endTime || null;

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
            scheduledStartTime: effectiveStart,
            scheduledEndTime: effectiveEnd,
            actualStartTime: effectiveStart,
            actualEndTime: effectiveEnd,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ];
      })();

      queryClient.setQueryData<TaskCompletion[]>(["completions", userId], nextCompletions);

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
    onMutate: async ({ taskId, date }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      await queryClient.cancelQueries({ queryKey: ["completions", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const prevCompletions = queryClient.getQueryData<TaskCompletion[]>([
        "completions",
        userId,
      ]);

      const targetTask = prevTasks?.find((t) => t.id === taskId);
      let targetDoneStatus = "DONE";
      if (targetTask?.projectId) {
        const projects = getStoredProjects(userId);
        const project = projects.find((p) => p.id === targetTask.projectId);
        const columns = project ? getProjectColumns(project) : DEFAULT_PROJECT_COLUMNS;
        const doneColumn =
          columns.find((c) => c.isDone) ||
          columns[columns.length - 1] ||
          DEFAULT_PROJECT_COLUMNS[DEFAULT_PROJECT_COLUMNS.length - 1];
        targetDoneStatus = doneColumn.id;
      }

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) =>
          t.id === taskId ? { ...t, projectStatus: targetDoneStatus } : t,
        ),
      );

      const effectiveStart =
        targetTask?.dateOverrides?.[date]?.startTime !== undefined
          ? targetTask.dateOverrides[date].startTime
          : targetTask?.startTime || null;
      const effectiveEnd =
        targetTask?.dateOverrides?.[date]?.endTime !== undefined
          ? targetTask.dateOverrides[date].endTime
          : targetTask?.endTime || null;

      queryClient.setQueryData<TaskCompletion[]>(
        ["completions", userId],
        (old = []) => {
          const exists = old.some((c) => c.taskId === taskId && c.date === date);
          if (exists) {
            return old.map((c) =>
              c.taskId === taskId && c.date === date ? { ...c, completed: true } : c,
            );
          }
          return [
            {
              id: "comp-" + Date.now(),
              taskId,
              userId,
              date,
              completed: true,
              value: null,
              duration: null,
              notes: null,
              scheduledStartTime: effectiveStart,
              scheduledEndTime: effectiveEnd,
              actualStartTime: effectiveStart,
              actualEndTime: effectiveEnd,
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
        queryClient.setQueryData(["completions", userId], context.prevCompletions);
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
      reopenAllDates,
    }: {
      taskId: string;
      date: string;
      skipProjectStatusReset?: boolean;
      reopenAllDates?: boolean;
    }) => {
      await reopenTaskAsIncomplete(taskId, date, userId, {
        skipProjectStatusReset,
        reopenAllDates,
      });
    },
    onMutate: async ({ taskId, skipProjectStatusReset, reopenAllDates, date }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      await queryClient.cancelQueries({ queryKey: ["completions", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);
      const prevCompletions = queryClient.getQueryData<TaskCompletion[]>([
        "completions",
        userId,
      ]);

      if (!skipProjectStatusReset) {
        const targetTask = prevTasks?.find((t) => t.id === taskId);
        let firstColumnId = "TODO";
        if (targetTask?.projectId) {
          const projects = getStoredProjects(userId);
          const project = projects.find((p) => p.id === targetTask.projectId);
          const columns = project ? getProjectColumns(project) : DEFAULT_PROJECT_COLUMNS;
          const firstColumn = columns[0] || DEFAULT_PROJECT_COLUMNS[0];
          firstColumnId = firstColumn.id;
        }

        queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
          old.map((t) =>
            t.id === taskId ? { ...t, projectStatus: firstColumnId } : t,
          ),
        );
      }

      // Optimistically uncomplete records in cache
      queryClient.setQueryData<TaskCompletion[]>(
        ["completions", userId],
        (old = []) =>
          old.map((c) => {
            if (c.taskId === taskId && (reopenAllDates || c.date === date)) {
              return { ...c, completed: false, actualStartTime: null, actualEndTime: null };
            }
            return c;
          }),
      );

      return { prevTasks, prevCompletions };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks", userId], context.prevTasks);
      }
      if (context?.prevCompletions) {
        queryClient.setQueryData(["completions", userId], context.prevCompletions);
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
      await syncProjectStatusToDoneColumn(taskId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // --- Execution / Active Timer Mutations ---
  const startTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const nowTime = format(new Date(), "HH:mm");
      const currentTasks =
        queryClient.getQueryData<Task[]>(["tasks", userId]) ||
        queryClient.getQueryData<Task[]>(["tasks"]) ||
        getStoredTasks(userId);
      const targetTask = currentTasks.find((t) => t.id === taskId);
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

      try {
        const _projects = getStoredProjects(userId);
        const _project = targetTask?.projectId ? _projects.find((p) => p.id === targetTask.projectId) : null;
        await LiveActivityBridge.startActivity(
          {
            taskId,
            taskTitle: targetTask?.title || "Tâche en cours",
            category: targetTask?.category,
            projectColor: _project?.color,
            projectName: _project?.name,
          },
          {
            currentStatus: "IN_PROGRESS",
            startedAtTimestamp: Math.floor(Date.now() / 1000),
            elapsedSeconds: 0,
            targetDurationSeconds: ((targetTask?.targetValue || 30) as number) * 60,
            totalFormattedDuration: `${targetTask?.targetValue || 30} min`,
            subtitle: targetTask?.category || "En cours",
            progress: 0,
          }
        );
      } catch {}
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", userId]) || queryClient.getQueryData<Task[]>(["tasks"]);
      const nowIso = new Date().toISOString();

      const updater = (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t) => (t.id === taskId ? { ...t, isActive: true, startedAt: nowIso } : t));
      };

      queryClient.setQueryData<Task[]>(["tasks", userId], updater);
      queryClient.setQueryData<Task[]>(["tasks"], updater);

      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", userId], context.previousTasks);
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
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
      const currentTasks =
        queryClient.getQueryData<Task[]>(["tasks", userId]) ||
        queryClient.getQueryData<Task[]>(["tasks"]) ||
        getStoredTasks(userId);
      const targetTask = currentTasks.find((t) => t.id === taskId);
      const isRecurring =
        targetTask?.recurrence && targetTask.recurrence !== "ONCE";

      let actualStart = nowTime;
      let durationMinutes = 1;
      let targetDate = date || getTodayDateString();

      if (targetTask?.startedAt) {
        const startDate = new Date(targetTask.startedAt);
        if (!isNaN(startDate.getTime())) {
          actualStart = format(startDate, "HH:mm");
          const diffMinutes = Math.round(
            (now.getTime() - startDate.getTime()) / 60000,
          );
          durationMinutes = Math.max(1, diffMinutes);
          targetDate = date || format(startDate, "yyyy-MM-dd");
        }
      }

      const completions =
        queryClient.getQueryData<TaskCompletion[]>(["completions", userId]) ||
        getStoredCompletions(userId);
      const existing = completions.find(
        (c) => c.taskId === taskId && c.date === targetDate,
      );

      if (!targetTask?.startedAt) {
        if (existing?.actualStartTime) {
          actualStart = existing.actualStartTime;
        } else if (targetTask?.startTime) {
          actualStart = targetTask.startTime;
        }
        const [sH, sM] = actualStart.split(":").map(Number);
        const [eH, eM] = nowTime.split(":").map(Number);
        if (!isNaN(sH) && !isNaN(eH)) {
          let diff = eH * 60 + eM - (sH * 60 + sM);
          if (diff < 0) diff += 24 * 60;
          durationMinutes = Math.max(1, diff);
        }
      }

      const prevDuration = existing?.completed && typeof existing.duration === "number" ? existing.duration : 0;
      const totalAccumulatedDuration = prevDuration + durationMinutes;
      const earliestStart = existing?.actualStartTime || actualStart;

      // 1. Immediately deactivate task in database and local storage
      await updateDbTaskActive(taskId, false, userId);

      // 2. Stop Live Activity
      try {
        await LiveActivityBridge.stopActivity(taskId);
      } catch {}

      // 3. Update schedule defensively
      try {
        await updateTaskSchedule({
          taskId,
          date: targetDate,
          startTime: earliestStart,
          endTime: nowTime,
          applyToAll: !isRecurring,
          userId,
        });
      } catch (err) {
        console.warn("finishTaskExecution updateTaskSchedule error:", err);
      }

      // 4. Log completion with exact start time, end time, and accumulated duration
      try {
        await upsertDbCompletion({
          taskId,
          userId,
          date: targetDate,
          completed: true,
          duration: totalAccumulatedDuration,
          actualStartTime: earliestStart,
          actualEndTime: nowTime,
          scheduledStartTime: earliestStart,
          scheduledEndTime: nowTime,
        });
      } catch (err) {
        console.warn("finishTaskExecution upsertDbCompletion error:", err);
      }

      // 5. Sync project status if linked to project
      try {
        await syncProjectStatusToDoneColumn(taskId, userId);
      } catch (err) {
        console.warn("finishTaskExecution syncProjectStatusToDoneColumn error:", err);
      }

      // 6. Cancel any scheduled push notifications for this finished task
      cancelTaskPushNotifications({ taskId, userId }).catch(() => {});
    },
    onMutate: async ({ taskId, date }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["completions"] });

      const previousTasks =
        queryClient.getQueryData<Task[]>(["tasks", userId]) ||
        queryClient.getQueryData<Task[]>(["tasks"]);
      const previousCompletions =
        queryClient.getQueryData<TaskCompletion[]>(["completions", userId]) ||
        queryClient.getQueryData<TaskCompletion[]>(["completions"]);

      const now = new Date();
      const nowTime = format(now, "HH:mm");
      const targetTask = previousTasks?.find((t) => t.id === taskId);
      let actualStart = nowTime;
      let durationMinutes = 1;
      let targetDate = date || getTodayDateString();

      if (targetTask?.startedAt) {
        const startDate = new Date(targetTask.startedAt);
        if (!isNaN(startDate.getTime())) {
          actualStart = format(startDate, "HH:mm");
          durationMinutes = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / 60000));
          targetDate = date || format(startDate, "yyyy-MM-dd");
        }
      } else if (targetTask?.startTime) {
        actualStart = targetTask.startTime;
      }

      // 1. Optimistically update tasks
      const taskUpdater = (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t) => (t.id === taskId ? { ...t, isActive: false, startedAt: null } : t));
      };
      queryClient.setQueryData<Task[]>(["tasks", userId], taskUpdater);
      queryClient.setQueryData<Task[]>(["tasks"], taskUpdater);

      // 2. Optimistically update completions
      const completionUpdater = (old: any) => {
        const list = Array.isArray(old) ? [...old] : [];
        const existingIdx = list.findIndex((c) => c.taskId === taskId && c.date === targetDate);
        const completionItem: TaskCompletion = {
          id: existingIdx >= 0 ? list[existingIdx].id : `comp-${Date.now()}`,
          taskId,
          userId,
          date: targetDate,
          completed: true,
          duration: durationMinutes,
          actualStartTime: actualStart,
          actualEndTime: nowTime,
          scheduledStartTime: actualStart,
          scheduledEndTime: nowTime,
          createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : now.toISOString(),
          updatedAt: now.toISOString(),
        };
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...completionItem };
        } else {
          list.unshift(completionItem);
        }
        return list;
      };
      queryClient.setQueryData<TaskCompletion[]>(["completions", userId], completionUpdater);
      queryClient.setQueryData<TaskCompletion[]>(["completions"], completionUpdater);

      return { previousTasks, previousCompletions };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", userId], context.previousTasks);
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      if (context?.previousCompletions) {
        queryClient.setQueryData(["completions", userId], context.previousCompletions);
        queryClient.setQueryData(["completions"], context.previousCompletions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const toggleTaskActive = useMutation({
    mutationFn: async (args: string | { taskId: string; date?: string; forceStop?: boolean }) => {
      const taskId = typeof args === "string" ? args : args.taskId;
      const date =
        typeof args === "string"
          ? getTodayDateString()
          : args.date || getTodayDateString();
      const forceStop = typeof args === "object" ? args.forceStop : false;

      if (forceStop) {
        await finishTaskExecution.mutateAsync({ taskId, date });
        return;
      }

      const currentTasks =
        queryClient.getQueryData<Task[]>(["tasks", userId]) ||
        queryClient.getQueryData<Task[]>(["tasks"]) ||
        getStoredTasks(userId);
      const target = currentTasks.find((t) => t.id === taskId);
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
    stopTaskExecution: finishTaskExecution,
    toggleTaskActive,
  };
}
