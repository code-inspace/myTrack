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

  const { data: allTasks = getStoredTasks(userId) } = useQuery({
    queryKey: ["tasks", userId],
    queryFn: async () => fetchTasks(userId),
    placeholderData: () => getStoredTasks(userId),
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
  });

  const { data: allCompletions = getStoredCompletions(userId) } = useQuery({
    queryKey: ["completions", userId],
    queryFn: async () => fetchCompletions(userId),
    placeholderData: () => getStoredCompletions(userId),
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
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
  const activeTask = allTasks.find((t) => t.isActive && !t.isArchived);

  useEffect(() => {
    if (sortedTasks.length > 0) {
      LiveActivityBridge.syncTasks(sortedTasks);
    }
  }, [sortedTasks]);

  return {
    tasks: sortedTasks,
    allTasks,
    allCompletions,
    activeTask,
    isLoading: false,
  };
}
