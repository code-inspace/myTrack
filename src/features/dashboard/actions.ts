import { DashboardStats, Period } from "./types";
import { getStoredTasks, getStoredCompletions } from "../tasks/actions";
import { calculateDashboardStats } from "../analytics/calculations";

export function getDashboardData(period: Period = "week", userId?: string): DashboardStats {
  const tasks = getStoredTasks(userId);
  const completions = getStoredCompletions(userId);
  return calculateDashboardStats(tasks, completions, period);
}
