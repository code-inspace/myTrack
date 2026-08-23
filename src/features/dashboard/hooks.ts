"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardQueryKeys } from "./queries";
import { getDashboardData } from "./actions";
import { Period } from "./types";
import { taskQueryKeys } from "../tasks/queries";
import { useAuth } from "@/providers/AuthProvider";
import { format } from "date-fns";

export function useDashboardStats(period: Period = "week", referenceDate: Date = new Date()) {
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";
  const refDateKey = format(referenceDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: [
      ...dashboardQueryKeys.stats(period),
      userId,
      refDateKey,
      ...taskQueryKeys.all,
      ...taskQueryKeys.completions(),
    ],
    queryFn: async () => getDashboardData(period, userId, referenceDate),
  });
}
