"use client";

import { useEffect, useState } from "react";
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
  isOvernightTimeRange,
} from "@/lib/dates";
import { mapTaskWithCompletion, sortTasksByPriority } from "../mappers";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { parseISO, subDays, format } from "date-fns";
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { getStoredExternalEvents } from "@/features/calendar/actions/storage";
import { getStoredProjects } from "@/features/projects/actions";

export function useTasks(selectedDateStr: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "";
  const [externalEventsVersion, setExternalEventsVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleEventsUpdated = () => setExternalEventsVersion((v) => v + 1);
    window.addEventListener("mytrack:external-events-updated", handleEventsUpdated);
    return () =>
      window.removeEventListener("mytrack:external-events-updated", handleEventsUpdated);
  }, []);

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
  const yesterdayStr = format(subDays(selectedDate, 1), "yyyy-MM-dd");
  const yesterdayDate = subDays(selectedDate, 1);

  // Filter tasks scheduled for the selected date, including cross-day overnight tasks
  const isScheduledOn = (task: Task, targetDate: Date, targetDateStr: string) => {
    if (task.recurrence === "ONCE") {
      const originalDate = task.createdAt
        ? task.createdAt.split("T")[0]
        : todayStr;

      const isCompletedOnTarget = allCompletions.some(
        (c) => c.taskId === task.id && c.date === targetDateStr && c.completed
      );
      if (isCompletedOnTarget) return true;

      const isCompletedOnOther = allCompletions.some(
        (c) => c.taskId === task.id && c.completed && c.date !== targetDateStr
      );
      if (isCompletedOnOther) return false;

      if (targetDateStr < todayStr) return false;
      if (targetDateStr === todayStr) return originalDate <= todayStr;
      return originalDate === targetDateStr;
    }

    const scheduled = isTaskScheduledForDate(
      task.recurrence,
      task.recurrenceConfig,
      targetDate,
      task.createdAt,
      task.dateOverrides
    );
    if (scheduled) return true;

    return allCompletions.some(
      (c) => c.taskId === task.id && c.date === targetDateStr && c.completed
    );
  };

  const filteredTasks: TaskWithCompletion[] = [];
  for (const task of allTasks) {
    if (task.isArchived) continue;

    // 1. Overnight task originating from yesterday
    const isYesterdayScheduled = isScheduledOn(task, yesterdayDate, yesterdayStr);
    if (isYesterdayScheduled) {
      const yesterdayOverride = task.dateOverrides?.[yesterdayStr];
      const sTime = yesterdayOverride?.startTime !== undefined ? yesterdayOverride.startTime : task.startTime;
      const eTime = yesterdayOverride?.endTime !== undefined ? yesterdayOverride.endTime : task.endTime;

      if (isOvernightTimeRange(sTime, eTime)) {
        const mapped = mapTaskWithCompletion(task, allCompletions, selectedDateStr);
        const isComp = mapped.isCompletedToday || allCompletions.some(
          (c) => c.taskId === task.id && c.date === yesterdayStr && c.completed
        );
        filteredTasks.push({
          ...mapped,
          isCompletedToday: isComp,
          effectiveStartTime: sTime,
          effectiveEndTime: eTime,
          overnightPart: "end",
          overnightOriginDate: yesterdayStr,
        });
      }
    }

    // 2. Tasks scheduled on target date
    const isTodayScheduled = isScheduledOn(task, selectedDate, selectedDateStr);
    if (isTodayScheduled) {
      const mapped = mapTaskWithCompletion(task, allCompletions, selectedDateStr);
      const isOvernight = isOvernightTimeRange(mapped.effectiveStartTime, mapped.effectiveEndTime);
      filteredTasks.push({
        ...mapped,
        overnightPart: isOvernight ? "start" : undefined,
        overnightOriginDate: isOvernight ? selectedDateStr : undefined,
      });
    }
  }


  const sortedTasks = sortTasksByPriority(filteredTasks);
  const activeTasksList = allTasks.filter((t) => t.isActive && !t.isArchived).slice(0, 2);
  const activeTask = activeTasksList[0] || null;

  useEffect(() => {
    if (sortedTasks) {
      const projects = getStoredProjects(userId);
      const projectMap = new Map(projects.map((p) => [p.id, p]));

      const mappedActiveTasks = activeTasksList.map((t) => {
        const project = t.projectId ? projectMap.get(t.projectId) : null;
        return {
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
          color: project?.color || "#D4F63D",
          projectName: project?.name,
          projectColor: project?.color,
        };
      });

      // Récupérer les événements externes stockés pour aujourd'hui (Apple / Google / ICS / CalDAV)
      const todayDate = getTodayDateString();
      const storedExternalEvents = getStoredExternalEvents(userId);
      const todayExternalEvents = storedExternalEvents.filter(
        (e) => e.date === todayDate
      );

      const mappedExternalEvents = todayExternalEvents.map((evt) => {
        const project = evt.projectId ? projectMap.get(evt.projectId) : null;
        const timeLabel = evt.isAllDay
          ? "Toute la journée"
          : evt.startTime && evt.endTime
          ? `${evt.startTime} - ${evt.endTime}`
          : evt.startTime || "Événement";

        return {
          id: `ext_${evt.id}`,
          title: evt.title || "Événement",
          category: evt.calendarName || "Agenda",
          subtitle: timeLabel,
          targetFormattedDuration: timeLabel,
          isHabit: false,
          isExternal: true,
          color: project?.color || evt.calendarColor || "#3B82F6",
          startTime: evt.startTime || null,
          isCompletedToday: false,
          projectName: project?.name,
          projectColor: project?.color,
        };
      });

      const mappedTasks = sortedTasks.map((t) => {
        const project = t.projectId ? projectMap.get(t.projectId) : null;
        return {
          ...t,
          color: project?.color || undefined,
          projectColor: project?.color || undefined,
          projectName: project?.name || undefined,
        };
      });

      // Synchroniser l'ensemble des items (événements d'agenda + tâches)
      const allWidgetItems = [...mappedExternalEvents, ...mappedTasks];

      LiveActivityBridge.syncTasks(
        allWidgetItems,
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
  }, [sortedTasks, activeTasksList, externalEventsVersion, userId]);

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
