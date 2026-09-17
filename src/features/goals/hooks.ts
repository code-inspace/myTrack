"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Goal } from "./types";
import { fetchGoals, createDbGoal, updateDbGoal, deleteDbGoal } from "./actions";
import { useAuth } from "@/providers/AuthProvider";

export function useGoals() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const queryClient = useQueryClient();

  const query = useQuery<Goal[]>({
    queryKey: ["goals", userId],
    queryFn: () => fetchGoals(userId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const createGoalMutation = useMutation({
    mutationFn: (payload: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">) =>
      createDbGoal(payload, userId),
    onSuccess: (newGoal) => {
      queryClient.setQueryData<Goal[]>(["goals", userId], (old = []) => [
        newGoal,
        ...old.filter((g) => g.id !== newGoal.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["goals", userId] });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Goal> }) =>
      updateDbGoal(id, updates, userId),
    onSuccess: (updatedGoal) => {
      queryClient.setQueryData<Goal[]>(["goals", userId], (old = []) =>
        old.map((g) => (g.id === updatedGoal.id ? updatedGoal : g))
      );
      queryClient.invalidateQueries({ queryKey: ["goals", userId] });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: string) => deleteDbGoal(goalId, userId),
    onSuccess: (_, goalId) => {
      queryClient.setQueryData<Goal[]>(["goals", userId], (old = []) =>
        old.filter((g) => g.id !== goalId)
      );
      queryClient.invalidateQueries({ queryKey: ["goals", userId] });
    },
  });

  return {
    goals: query.data || [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    createGoal: createGoalMutation.mutateAsync,
    updateGoal: updateGoalMutation.mutateAsync,
    deleteGoal: deleteGoalMutation.mutateAsync,
    isCreating: createGoalMutation.isPending,
    isUpdating: updateGoalMutation.isPending,
    isDeleting: deleteGoalMutation.isPending,
  };
}
