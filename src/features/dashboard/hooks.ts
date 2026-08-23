"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardQueryKeys } from "./queries";
import { getDashboardData } from "./actions";
import { Period } from "./types";
import { taskQueryKeys } from "../tasks/queries";

export function useDashboardStats(period: Period = "week") {
  return useQuery({
    queryKey: [...dashboardQueryKeys.stats(period), ...taskQueryKeys.all, ...taskQueryKeys.completions()],
    queryFn: async () => getDashboardData(period),
  });
}
