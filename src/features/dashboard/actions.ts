import { DashboardStats, Period } from "./types";
import { fetchTasks, fetchCompletions } from "../tasks/actions";
import { calculateDashboardStats } from "../analytics/calculations";

export async function getDashboardData(
  period: Period = "week",
  userId?: string,
  referenceDate: Date = new Date()
): Promise<DashboardStats> {
  const safeRefDate =
    referenceDate instanceof Date && !isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  try {
    const [tasks, completions] = await Promise.all([
      fetchTasks(userId).catch(() => []),
      fetchCompletions(userId).catch(() => []),
    ]);
    return calculateDashboardStats(tasks || [], completions || [], period, safeRefDate);
  } catch (error) {
    console.warn("Error calculating dashboard stats, returning fallback:", error);
    return calculateDashboardStats([], [], period, safeRefDate);
  }
}
