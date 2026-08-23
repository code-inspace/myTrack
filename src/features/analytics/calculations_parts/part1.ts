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