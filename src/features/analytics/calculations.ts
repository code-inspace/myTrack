import { parseISO, subDays, format } from "date-fns";
import { DashboardStats, DayStatus, HabitStreakStat, HabitRollingDay, MomentumPoint, Period } from "./types";
import { isTaskScheduledForDate } from "@/lib/dates";

export interface TaskRecord {
  id: string;
  title: string;
  tag?: string;
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
      category: (task as any).tag || task.category || "General",
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
  // Filter out one-shot tasks: Dashboard only tracks recurring habits
  const recurringTasks = tasks.filter((t) => t.recurrence && t.recurrence !== "ONCE");
  const recurringTaskIds = new Set(recurringTasks.map((t) => t.id));
  const recurringCompletions = completions.filter((c) => recurringTaskIds.has(c.taskId));

  const habitStreaks = calculateHabitStreakStats(recurringTasks, recurringCompletions, referenceDate);
  const last7DaysStatus = calculateLast7DaysStatus(recurringTasks, recurringCompletions, referenceDate);

  // Period calculation
  const daysInPeriod = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 60;
  let totalScheduledInPeriod = 0;
  let totalCompletedInPeriod = 0;

  for (let i = daysInPeriod - 1; i >= 0; i--) {
    const dateObj = subDays(referenceDate, i);
    const dateStr = format(dateObj, "yyyy-MM-dd");

    const scheduled = recurringTasks.filter((t) =>
      isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dateObj, t.createdAt)
    ).length;

    const completed = recurringCompletions.filter((c) => c.date === dateStr && c.completed).length;

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

  // Period-aware Curve Points Generation (Jour | Semaine | Mois | Tout le temps)
  const momentumHistory: MomentumPoint[] = [];

  if (period === "day") {
    // 5 progressive hourly segments across the day
    const dayDateStr = format(referenceDate, "yyyy-MM-dd");
    const dayCompleted = recurringCompletions.filter((c) => c.date === dayDateStr && c.completed).length;
    const dayScheduled = recurringTasks.filter((t) =>
      isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, referenceDate, t.createdAt)
    ).length;

    const dayScore =
      dayScheduled > 0
        ? Math.round((dayCompleted / dayScheduled) * 100)
        : dayCompleted > 0
        ? 100
        : 0;

    const dayHours = [
      { label: "8h", ratio: 0.2 },
      { label: "11h", ratio: 0.4 },
      { label: "14h", ratio: 0.6 },
      { label: "17h", ratio: 0.8 },
      { label: "20h", ratio: 1.0 },
    ];

    for (const h of dayHours) {
      const pointCompleted = Math.round(dayCompleted * h.ratio);
      const pointScheduled = Math.max(1, Math.round(dayScheduled * h.ratio));
      const pointScore = Math.min(100, Math.round(dayScore * h.ratio));

      momentumHistory.push({
        date: `${dayDateStr}T${h.label}:00`,
        label: h.label,
        score: pointScore,
        completedCount: pointCompleted,
        totalScheduled: pointScheduled,
      });
    }
  } else if (period === "week") {
    // 7 days of the reference week (Monday to Sunday)
    for (let i = 0; i < 7; i++) {
      const dayDate = subDays(referenceDate, 6 - i);
      const dayDateStr = format(dayDate, "yyyy-MM-dd");
      const dayCompleted = recurringCompletions.filter((c) => c.date === dayDateStr && c.completed).length;
      const dayScheduled = recurringTasks.filter((t) =>
        isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dayDate, t.createdAt)
      ).length;

      const dayName = FRENCH_DAYS[dayDate.getDay()];
      const dayScore =
        dayScheduled > 0
          ? Math.round((dayCompleted / dayScheduled) * 100)
          : dayCompleted > 0
          ? 100
          : 0;

      momentumHistory.push({
        date: dayDateStr,
        label: `${dayName} ${format(dayDate, "d")}`,
        score: dayScore,
        completedCount: dayCompleted,
        totalScheduled: dayScheduled,
      });
    }
  } else if (period === "month") {
    // 4 to 5 weekly segments of the month (e.g. Sem 1, Sem 2, Sem 3, Sem 4, Sem 5)
    for (let w = 4; w >= 0; w--) {
      let weekCompleted = 0;
      let weekScheduled = 0;
      const weekEndDate = subDays(referenceDate, w * 6);

      for (let d = 0; d < 6; d++) {
        const currDate = subDays(weekEndDate, d);
        const currDateStr = format(currDate, "yyyy-MM-dd");
        weekCompleted += recurringCompletions.filter((c) => c.date === currDateStr && c.completed).length;
        weekScheduled += recurringTasks.filter((t) =>
          isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, currDate, t.createdAt)
        ).length;
      }

      const weekScore =
        weekScheduled > 0
          ? Math.round((weekCompleted / weekScheduled) * 100)
          : weekCompleted > 0
          ? 100
          : 0;

      momentumHistory.push({
        date: format(weekEndDate, "yyyy-MM-dd"),
        label: `Sem ${5 - w}`,
        score: weekScore,
        completedCount: weekCompleted,
        totalScheduled: weekScheduled,
      });
    }
  } else {
    // All-time: 6 monthly aggregate progression points
    for (let m = 5; m >= 0; m--) {
      let monthCompleted = 0;
      let monthScheduled = 0;
      const monthRef = subDays(referenceDate, m * 30);

      for (let d = 0; d < 30; d++) {
        const currDate = subDays(monthRef, d);
        const currDateStr = format(currDate, "yyyy-MM-dd");
        monthCompleted += recurringCompletions.filter((c) => c.date === currDateStr && c.completed).length;
        monthScheduled += recurringTasks.filter((t) =>
          isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, currDate, t.createdAt)
        ).length;
      }

      const monthScore =
        monthScheduled > 0
          ? Math.round((monthCompleted / monthScheduled) * 100)
          : monthCompleted > 0
          ? 100
          : 0;

      const FRENCH_MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      const monthLabel = FRENCH_MONTHS_SHORT[monthRef.getMonth()];

      momentumHistory.push({
        date: format(monthRef, "yyyy-MM-dd"),
        label: monthLabel,
        score: monthScore,
        completedCount: monthCompleted,
        totalScheduled: monthScheduled,
      });
    }
  }

  const totalWins = totalCompletedInPeriod;
  const totalTargetWins = Math.max(totalWins, totalScheduledInPeriod);
  const averageDailyCompletion = Math.round(completionRate);
  const tasksMissed = Math.max(0, totalScheduledInPeriod - totalCompletedInPeriod);
  const globalStreak = calculateCurrentStreak(recurringCompletions, referenceDate);
  const bestGlobalStreak = calculateBestStreak(recurringCompletions);

  return {
    momentum,
    momentumDelta: 10,
    momentumHistory,
    completionRate,
    totalWins,
    totalTargetWins,
    currentStreak: globalStreak,
    bestStreak: Math.max(bestGlobalStreak, globalStreak),
    last7DaysStatus,
    habitStreaks,
    tasksCompleted: totalCompletedInPeriod,
    tasksMissed,
    averageDailyCompletion,
  };
}
