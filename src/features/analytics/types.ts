export type Period = "week" | "month" | "all";

export interface DayStatus {
  date: string;
  dayName: string;
  completedCount: number;
  totalScheduled: number;
  isAllCompleted: boolean;
  status: "completed" | "missed" | "empty";
}

export interface MomentumPoint {
  date: string;
  label: string;
  score: number;
}

export interface DashboardStats {
  momentum: number;
  momentumDelta: number; // e.g. +10
  momentumHistory: MomentumPoint[];
  completionRate: number; // e.g. 40 (%)
  totalWins: number; // e.g. 15
  totalTargetWins: number; // e.g. 20
  currentStreak: number; // e.g. 4
  bestStreak: number;
  last7DaysStatus: DayStatus[];
  tasksCompleted: number;
  tasksMissed: number;
  averageDailyCompletion: number;
}
