export type Period = "day" | "week" | "month" | "all";

export interface DayStatus {
  date: string;
  dayName: string;
  completedCount: number;
  totalScheduled: number;
  isAllCompleted: boolean;
  completionPercentage: number;
  status: "completed" | "missed" | "empty";
}

export interface HabitRollingDay {
  date: string;
  dayName: string; // e.g. "Lun", "Mar"
  isScheduled: boolean;
  isCompleted: boolean;
}

export interface HabitStreakStat {
  taskId: string;
  taskTitle: string;
  tag?: string;
  category: string;
  currentStreak: number;
  bestStreak: number;
  rolling7Days: HabitRollingDay[];
  completionRate7Days: number; // Percentage over scheduled days
}

export interface DashboardStats {
  completionRate: number; // e.g. 40 (%)
  currentStreak: number;
  bestStreak: number;
  last7DaysStatus: DayStatus[];
  habitStreaks: HabitStreakStat[];
}
