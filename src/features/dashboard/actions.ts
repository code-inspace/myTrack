import { DashboardStats, Period } from "./types";
import { fetchTasks, fetchCompletions } from "../tasks/actions";
import { calculateDashboardStats } from "../analytics/calculations";

export async function getDashboardData(period: Period = "week", userId?: string): Promise<DashboardStats> {
  const [tasks, completions] = await Promise.all([
    fetchTasks(userId),
    fetchCompletions(userId),
  ]);
  return calculateDashboardStats(tasks, completions, period);
}
