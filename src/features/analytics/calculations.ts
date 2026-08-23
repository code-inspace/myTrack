import { parseISO, subDays, format } from "date-fns";
import { DashboardStats, DayStatus, HabitStreakStat, HabitRollingDay, MomentumPoint, Period } from "./types";
import { isTaskScheduledForDate } from "@/lib/dates";

export interface TaskRecord {
  id: string;
  title: string;
  category: string;
  recurrence: "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM";
  recurrenceConfig?: { days?: number[] } | null;
  targetValue?: number | null;
  unit?: string | null;
  trackingType: "BOOLEAN" | "NUMBER" | "DURATION" | "QUANTITY";
  createdAt?: string | Date;
}

export interface CompletionRecord {
  id: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  value?: number | null;
  duration?: number | null;
}

const FRENCH_DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/**
 * Calculates current consecutive streak up to referenceDate
 */
export function calculateCurrentStreak(
  completions: CompletionRecord[],
  referenceDate: Date = new Date()
): number {
  if (!completions || completions.length === 0) return 0;

  const completedDates = new Set<string>();
  for (const c of completions) {
    if (c.completed) {
      completedDates.add(c.date);
    }
  }

  let streak = 0;
  let checkDate = referenceDate;
  const todayStr = format(referenceDate, "yyyy-MM-dd");

  if (!completedDates.has(todayStr)) {
    checkDate = subDays(referenceDate, 1);
  }

  while (true) {
    const dateStr = format(checkDate, "yyyy-MM-dd");
    if (completedDates.has(dateStr)) {
      streak += 1;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates the best streak ever recorded
 */
export function calculateBestStreak(completions: CompletionRecord[]): number {
  if (!completions || completions.length === 0) return 0;

  const completedDates = Array.from(
    new Set(completions.filter((c) => c.completed).map((c) => c.date))
  ).sort();

  if (completedDates.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < completedDates.length; i++) {
    const prev = parseISO(completedDates[i - 1]);
    const curr = parseISO(completedDates[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));

    if (diff === 1) {
      currentStreak += 1;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else if (diff > 1) {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * Calculates current consecutive streak for a specific habit / task
 */
export function calculateHabitStreak(
  taskId: string,
  completions: CompletionRecord[],
  referenceDate: Date = new Date()
): number {
  if (!completions || completions.length === 0) return 0;

  const taskCompletedDates = new Set<string>();
  for (const c of completions) {
    if (c.taskId === taskId && c.completed) {
      taskCompletedDates.add(c.date);
    }
  }

  let streak = 0;
  let checkDate = referenceDate;
  const todayStr = format(referenceDate, "yyyy-MM-dd");

  if (!taskCompletedDates.has(todayStr)) {
    checkDate = subDays(referenceDate, 1);
  }

  while (true) {
    const dateStr = format(checkDate, "yyyy-MM-dd");
    if (taskCompletedDates.has(dateStr)) {
      streak += 1;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates habit streak statistics and rolling 7 days status per task
 */
export function calculateHabitStreakStats(
  tasks: TaskRecord[],
  completions: CompletionRecord[],
  referenceDate: Date = new Date()
): HabitStreakStat[] {
  return tasks.map((task) => {
    const currentStreak = calculateHabitStreak(task.id, completions, referenceDate);

    // Calculate rolling 7 days (from 6 days ago to today)
    const rolling7Days: HabitRollingDay[] = [];
    let scheduledCount = 0;
    let completedCount = 0;

    for (let i = 6; i >= 0; i--) {
      const d = subDays(referenceDate, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayName = FRENCH_DAYS[d.getDay()];

      const isScheduled = isTaskScheduledForDate(
        task.recurrence,
        task.recurrenceConfig,
        d,
        task.createdAt
      );

      const isCompleted = completions.some(
        (c) => c.taskId === task.id && c.date === dateStr && c.completed
      );

      if (isScheduled) scheduledCount++;
      if (isCompleted) completedCount++;

      rolling7Days.push({
        date: dateStr,
        dayName,
        isScheduled,
        isCompleted,
      });
    }

    const completionRate7Days =
      scheduledCount > 0
        ? Math.round((completedCount / scheduledCount) * 100)
        : completedCount > 0
        ? 100
        : 0;

    return {
      taskId: task.id,
      taskTitle: task.title,
      category: task.category || "General",
      currentStreak,
      bestStreak: Math.max(currentStreak, 1),
      rolling7Days,
      completionRate7Days,
    };
  });
}

/**
 * Calculates day status and daily % for the last 7 days window
 */
export function calculateLast7DaysStatus(
  tasks: TaskRecord[],
  completions: CompletionRecord[],
  endDate: Date = new Date()
): DayStatus[] {
  const result: DayStatus[] = [];

  for (let i = 6; i >= 0; i--) {
    const dateObj = subDays(endDate, i);
    const dateStr = format(dateObj, "yyyy-MM-dd");
    const dayName = FRENCH_DAYS[dateObj.getDay()];

    const scheduledTasks = tasks.filter((t) =>
      isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dateObj, t.createdAt)
    );

    const dayCompletions = completions.filter((c) => c.date === dateStr && c.completed);
    const completedCount = dayCompletions.length;
    const totalScheduled = scheduledTasks.length;

    const completionPercentage =
      totalScheduled > 0
        ? Math.round((completedCount / totalScheduled) * 100)
        : completedCount > 0
        ? 100
        : 0;

    let status: "completed" | "missed" | "empty" = "empty";
    if (totalScheduled > 0) {
      status = completedCount >= totalScheduled ? "completed" : completedCount > 0 ? "completed" : "missed";
    } else if (completedCount > 0) {
      status = "completed";
    }

    result.push({
      date: dateStr,
      dayName,
      completedCount,
      totalScheduled,
      completionPercentage,
      isAllCompleted: totalScheduled > 0 ? completedCount >= totalScheduled : completedCount > 0,
      status,
    });
  }

  return result;
}

/**
 * Calculates comprehensive dashboard statistics
 */
export function calculateDashboardStats(
  tasks: TaskRecord[],
  completions: CompletionRecord[],
  period: Period = "week",
  referenceDate: Date = new Date()
): DashboardStats {
  const habitStreaks = calculateHabitStreakStats(tasks, completions, referenceDate);
  const last7DaysStatus = calculateLast7DaysStatus(tasks, completions, referenceDate);

  // Period calculation
  const daysInPeriod = period === "week" ? 7 : period === "month" ? 30 : 60;
  let totalScheduledInPeriod = 0;
  let totalCompletedInPeriod = 0;

  for (let i = daysInPeriod - 1; i >= 0; i--) {
    const dateObj = subDays(referenceDate, i);
    const dateStr = format(dateObj, "yyyy-MM-dd");

    const scheduled = tasks.filter((t) =>
      isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dateObj, t.createdAt)
    ).length;

    const completed = completions.filter((c) => c.date === dateStr && c.completed).length;

    totalScheduledInPeriod += scheduled;
    totalCompletedInPeriod += completed;
  }

  const completionRate =
    totalScheduledInPeriod > 0
      ? Math.min(100, Math.round((totalCompletedInPeriod / totalScheduledInPeriod) * 100))
      : totalCompletedInPeriod > 0
      ? 100
      : 0;

  // Average habit streak across active habits
  const avgHabitStreak =
    habitStreaks.length > 0
      ? habitStreaks.reduce((acc, h) => acc + h.currentStreak, 0) / habitStreaks.length
      : 0;

  // Adapted Momentum score based on habit completion consistency
  const streakBonus = Math.min(30, Math.round(avgHabitStreak * 8));
  const rawMomentum = Math.round(completionRate * 0.6 + streakBonus + Math.min(10, totalCompletedInPeriod * 1.5));
  const momentum = Math.max(0, Math.min(100, rawMomentum || (completionRate > 0 ? completionRate : 50)));

  // Momentum history curve generation (7 points)
  const momentumHistory: MomentumPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayDate = subDays(referenceDate, i);
    const dayDateStr = format(dayDate, "yyyy-MM-dd");
    const dayCompleted = completions.filter((c) => c.date === dayDateStr && c.completed).length;
    const dayScheduled = tasks.filter((t) =>
      isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dayDate, t.createdAt)
    ).length;

    const dayRate = dayScheduled > 0 ? (dayCompleted / dayScheduled) * 100 : dayCompleted > 0 ? 80 : 30;
    const dayScore = Math.min(100, Math.max(20, Math.round(dayRate * 0.7 + (6 - i) * 3 + dayCompleted * 8)));

    momentumHistory.push({
      date: dayDateStr,
      label: format(dayDate, "d"),
      score: dayScore,
    });
  }

  const totalWins = totalCompletedInPeriod;
  const totalTargetWins = Math.max(totalWins, totalScheduledInPeriod);
  const averageDailyCompletion = Math.round(completionRate);
  const tasksMissed = Math.max(0, totalScheduledInPeriod - totalCompletedInPeriod);

  return {
    momentum,
    momentumDelta: 10,
    momentumHistory,
    completionRate,
    totalWins,
    totalTargetWins,
    currentStreak: Math.round(avgHabitStreak),
    bestStreak: Math.max(...habitStreaks.map((h) => h.bestStreak), 1),
    last7DaysStatus,
    habitStreaks,
    tasksCompleted: totalCompletedInPeriod,
    tasksMissed,
    averageDailyCompletion,
  };
}
