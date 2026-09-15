"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Task, TaskCompletion, TaskWithCompletion } from "../types";
import {
  fetchTasks,
  fetchCompletions,
  getStoredTasks,
  getStoredCompletions,
} from "../actions";
import {
  isTaskScheduledForDate,
  isOnceTaskCarriedOver,
  getTodayDateString,
} from "@/lib/dates";
import { mapTaskWithCompletion, sortTasksByPriority } from "../mappers";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { parseISO } from "date-fns";
import { LiveActivityBridge } from "@/lib/native/liveActivity";

export function useTasks(selectedDateStr: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "";

  // Supabase Realtime Listener across devices
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-tasks-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_completions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["completions"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // Two-way synchronization with native iOS Widget & Live Activity
  useEffect(() => {
    const syncNativeActiveState = async () => {
      if (!LiveActivityBridge.isSupported()) return;
      try {
        const { hasActiveTask, task: nativeTask, activeTasks: nativeActiveTasks = [], lastStoppedTaskId } =
          await LiveActivityBridge.getActiveTask();
        
        const effectiveActiveTasks = nativeActiveTasks.length > 0 
          ? nativeActiveTasks 
          : (hasActiveTask && nativeTask?.taskId ? [nativeTask] : []);

        if (effectiveActiveTasks.length > 0) {
          const activeTaskIds = new Set(effectiveActiveTasks.map((t) => t.taskId));
          queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) => {
            let hasChanged = false;
            const updated = old.map((t) => {
              if (activeTaskIds.has(t.id)) {
                if (!t.isActive) {
                  hasChanged = true;
                  const item = effectiveActiveTasks.find((at) => at.taskId === t.id);
                  return {
                    ...t,
                    isActive: true,
                    startedAt: item?.startedAtTimestamp
                      ? new Date(item.startedAtTimestamp * 1000).toISOString()
                      : t.startedAt || new Date().toISOString(),
                  };
                }
              }
              return t;
            });
            return hasChanged ? updated : old;
          });
        } else if (lastStoppedTaskId) {
          queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
            old.map((t) =>
              t.id === lastStoppedTaskId && t.isActive
                ? { ...t, isActive: false, startedAt: null }
                : t,
            ),
          );
        }
      } catch {}
    };

    syncNativeActiveState();
    window.addEventListener("focus", syncNativeActiveState);
    document.addEventListener("visibilitychange", syncNativeActiveState);
    window.addEventListener("mytrack:tasks-sync-needed", syncNativeActiveState);
    return () => {
      window.removeEventListener("focus", syncNativeActiveState);
      document.removeEventListener("visibilitychange", syncNativeActiveState);
      window.removeEventListener("mytrack:tasks-sync-needed", syncNativeActiveState);
    };
  }, [userId, queryClient]);

  const {
    data: allTasks = getStoredTasks(userId),
    isLoading: tasksLoading,
    isRefetching: tasksRefetching,
  } = useQuery({
    queryKey: ["tasks", userId],
    queryFn: async () => fetchTasks(userId),
    initialData: () => {
      const stored = getStoredTasks(userId);
      return stored.length > 0 ? stored : undefined;
    },
    placeholderData: () => getStoredTasks(userId),
    enabled: Boolean(userId),
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Background fallback only, Supabase Realtime WebSocket handles instant sync
  });

  const {
    data: allCompletions = getStoredCompletions(userId),
    isLoading: completionsLoading,
    isRefetching: completionsRefetching,
  } = useQuery({
    queryKey: ["completions", userId],
    queryFn: async () => fetchCompletions(userId),
    initialData: () => {
      const stored = getStoredCompletions(userId);
      return stored.length > 0 ? stored : undefined;
    },
    placeholderData: () => getStoredCompletions(userId),
    enabled: Boolean(userId),
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Background fallback only
  });

  const selectedDate = parseISO(selectedDateStr);
  const todayStr = getTodayDateString();

  // Filter tasks scheduled for the selected date
  const filteredTasks: TaskWithCompletion[] = allTasks
    .filter((task) => !task.isArchived)
    .filter((task) => {
      // 1. One-shot tasks (ONCE)
      if (task.recurrence === "ONCE") {
        const originalDate = task.createdAt
          ? task.createdAt.split("T")[0]
          : todayStr;

        // Was it completed on this exact viewed date?
        const isCompletedOnThisDate = allCompletions.some(
          (c) =>
            c.taskId === task.id &&
            c.date === selectedDateStr &&
            c.completed,
        );
        if (isCompletedOnThisDate) return true;

        // Was it completed on any other date?
        const isCompletedOnOtherDate = allCompletions.some(
          (c) =>
            c.taskId === task.id &&
            c.completed &&
            c.date !== selectedDateStr,
        );
        if (isCompletedOnOtherDate) return false;

        // Task is NOT completed:
        // If viewing a past day (day is finished), it is removed from that past day
        if (selectedDateStr < todayStr) {
          return false;
        }

        // If viewing today: it carries over to today if originally scheduled on or before today
        if (selectedDateStr === todayStr) {
          return originalDate <= todayStr;
        }

        // If viewing a future date: only show if originally scheduled for that future date
        return originalDate === selectedDateStr;
      }

      // 2. Recurring tasks (DAILY, WEEKDAYS, WEEKLY, CUSTOM)
      const scheduled = isTaskScheduledForDate(
        task.recurrence,
        task.recurrenceConfig,
        selectedDate,
        task.createdAt,
        task.dateOverrides,
      );
      if (scheduled) return true;

      // Always show if completed on this date
      const isCompletedOnThisDate = allCompletions.some(
        (c) =>
          c.taskId === task.id &&
          c.date === selectedDateStr &&
          c.completed,
      );
      return isCompletedOnThisDate;
    })
    .map((task) =>
      mapTaskWithCompletion(task, allCompletions, selectedDateStr),
    );


  const sortedTasks = sortTasksByPriority(filteredTasks);
  const activeTasksList = allTasks.filter((t) => t.isActive && !t.isArchived).slice(0, 2);
  const activeTask = activeTasksList[0] || null;

  useEffect(() => {
    if (sortedTasks) {
      const mappedActiveTasks = activeTasksList.map((t) => ({
        taskId: t.id,
        taskTitle: t.title || "Tâche en cours",
        category: t.tag || t.category || "myTrack",
        subtitle: t.description || t.category || "En cours",
        startedAtTimestamp: t.startedAt
          ? Math.floor(new Date(t.startedAt).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
        totalFormattedDuration: t.targetValue
          ? `${t.targetValue} ${t.unit || "min"}`
          : undefined,
      }));

      LiveActivityBridge.syncTasks(
        sortedTasks,
        mappedActiveTasks[0] || null,
        mappedActiveTasks
      );

      // Si aucune tâche n'est active, synchroniser le mode veille Lock Screen
      if (mappedActiveTasks.length === 0) {
        const isStandbyEnabled =
          typeof window !== "undefined"
            ? localStorage.getItem("mytrack_lockscreen_standby") !== "false"
            : true;

        const firstUncompleted = sortedTasks.find(
          (t) => !t.isCompletedToday && !t.completion?.completed
        );

        LiveActivityBridge.syncStandby(firstUncompleted || null, isStandbyEnabled);
      }
    }
  }, [sortedTasks, activeTasksList]);

  const isInitialLoading = (tasksLoading && allTasks.length === 0);
  const isLoading = isInitialLoading || (completionsLoading && allCompletions.length === 0);

  return {
    tasks: sortedTasks,
    allTasks,
    allCompletions,
    activeTask,
    activeTasks: activeTasksList,
    isLoading,
    isInitialLoading,
    isSyncing: tasksRefetching || completionsRefetching,
  };
}
