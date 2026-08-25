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
        task.dateOverrides,
      );
      if (scheduled) return true;

      // Uncompleted one-shot tasks carry over to the next day(s) instead of disappearing
      if (task.recurrence === "ONCE") {
        // Completed specifically on the viewed day — always show it here (as done), even though
        // completion normally stops carry-over onto *later* days.
        const completedOnThisDate = allCompletions.some(
          (c) =>
            c.taskId === task.id &&
            c.date === selectedDateStr &&
            c.completed,
        );
        if (completedOnThisDate) return true;

        const originalDate = task.createdAt
          ? task.createdAt.split("T")[0]
          : null;
        const completedBeforeThisDate = allCompletions.some(
          (c) =>
            c.taskId === task.id &&
            c.completed &&
            c.date < selectedDateStr,
        );
        if (completedBeforeThisDate) return false;

        return isOnceTaskCarriedOver(
          originalDate,
          selectedDateStr,
          todayStr,
          false,
        );
      }

      return false;
    })
    .map((task) =>
      mapTaskWithCompletion(task, allCompletions, selectedDateStr),
    );

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
