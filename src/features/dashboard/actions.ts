import { DashboardStats, Period } from "./types";
import { getStoredTasks, getStoredCompletions } from "../tasks/actions";
import { calculateDashboardStats } from "../analytics/calculations";

export function getDashboardData(period: Period = "week"): DashboardStats {
  const tasks = getStoredTasks();
  const completions = getStoredCompletions();
  return calculateDashboardStats(tasks, completions, period);
}
