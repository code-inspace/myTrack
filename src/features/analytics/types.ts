export type Period = "week" | "month" | "all";

export interface DayStatus {
  date: string;
  dayName: string;
  completedCount: number;
  totalScheduled: number;
  isAllCompleted: boolean;
  completionPercentage: number;
  status: "completed" | "missed" | "empty";
}

export interface MomentumPoint {
  date: string;
  label: string;
  score: number; // Daily completion percentage 0-100%
  completedCount: number;
  totalScheduled: number;
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
  momentum: number;
  momentumDelta: number; // e.g. +10
  momentumHistory: MomentumPoint[];
  completionRate: number; // e.g. 40 (%)
  totalWins: number; // e.g. 15
  totalTargetWins: number; // e.g. 20
  currentStreak: number;
  bestStreak: number;
  last7DaysStatus: DayStatus[];
  habitStreaks: HabitStreakStat[];
  tasksCompleted: number;
  tasksMissed: number;
  averageDailyCompletion: number;
}
