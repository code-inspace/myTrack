"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardQueryKeys } from "./queries";
import { getDashboardData } from "./actions";
import { Period } from "./types";
import { taskQueryKeys } from "../tasks/queries";
import { useAuth } from "@/providers/AuthProvider";

export function useDashboardStats(period: Period = "week") {
  const { user } = useAuth();
  const userId = user?.id || "user-demo";

  return useQuery({
    queryKey: [
      ...dashboardQueryKeys.stats(period),
      userId,
      ...taskQueryKeys.all,
      ...taskQueryKeys.completions(),
    ],
    queryFn: async () => getDashboardData(period, userId),
  });
}
