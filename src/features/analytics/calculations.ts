import {
  parseISO,
  subDays,
  addDays,
  format,
  startOfWeek,
  startOfMonth,
  differenceInCalendarDays,
} from "date-fns";
import { DashboardStats, DayStatus, HabitStreakStat, HabitRollingDay, Period } from "./types";
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
  dateOverrides?: Record<string, { skipped?: boolean; startTime?: string | null; endTime?: string | null }> | null;
  isArchived?: boolean;
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
/** Upper bound for "all time" scans and streak walks (perf guard). */
const MAX_HISTORY_DAYS = 730;

function toDateStr(value: string | Date | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.split("T")[0] || null;
  return isNaN(value.getTime()) ? null : format(value, "yyyy-MM-dd");
}

/**
 * The one scheduling rule shared by the agenda and the stats: a habit occurs on a date when its
 * recurrence (and per-date overrides: moved / skipped occurrences) says so, it isn't archived, and
 * the date isn't before the habit's start date.
 */
export function isHabitScheduledOn(task: TaskRecord, date: Date): boolean {
  if (task.isArchived) return false;
  const startDate = toDateStr(task.createdAt);
  const dateStr = format(date, "yyyy-MM-dd");
  if (startDate && dateStr < startDate) return false;
  return isTaskScheduledForDate(task.recurrence, task.recurrenceConfig, date, task.createdAt, task.dateOverrides);
}

/** Scheduled habits of a date, and how many of them were completed that date. */
function getDayCounts(tasks: TaskRecord[], completedKeys: Set<string>, date: Date) {
  const dateStr = format(date, "yyyy-MM-dd");
  const scheduled = tasks.filter((t) => isHabitScheduledOn(t, date));
  const completed = scheduled.filter((t) => completedKeys.has(`${t.id}|${dateStr}`)).length;
  return { scheduled: scheduled.length, completed };
}

function getCompletedKeys(completions: CompletionRecord[]): Set<string> {
  return new Set(completions.filter((c) => c && c.completed && c.date).map((c) => `${c.taskId}|${c.date}`));
}

/** Completion ratio in %: 0 when nothing was scheduled (nothing to achieve isn't a 100% day). */
function ratio(completed: number, scheduled: number): number {
  return scheduled > 0 ? Math.min(100, Math.round((completed / scheduled) * 100)) : 0;
}

/**
 * Calendar range of a period, the same as goals use: the day, the Monday–Sunday week, the
 * calendar month, or everything since the first habit started — never past the reference date.
 */
export function getPeriodRange(
  period: Period,
  referenceDate: Date,
  tasks: TaskRecord[] = [],
): { start: Date; end: Date } {
  const end = referenceDate;
  if (period === "day") return { start: referenceDate, end };
  if (period === "week") return { start: startOfWeek(referenceDate, { weekStartsOn: 1 }), end };
  if (period === "month") return { start: startOfMonth(referenceDate), end };
  const startDates = tasks.map((t) => toDateStr(t.createdAt)).filter((d): d is string => Boolean(d)).sort();
  const earliest = startDates[0] ? parseISO(startDates[0]) : subDays(referenceDate, 59);
  const floor = subDays(referenceDate, MAX_HISTORY_DAYS - 1);
  const start = earliest < floor ? floor : earliest > referenceDate ? referenceDate : earliest;
  return { start, end };
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const count = Math.max(0, differenceInCalendarDays(end, start));
  for (let i = 0; i <= count; i++) days.push(addDays(start, i));
  return days;
}

/**
 * Calculates current consecutive streak up to referenceDate: consecutive days with at least one
 * completed habit. When `tasks` are given, days with no habit scheduled are skipped (they neither
 * extend nor break the streak). An unfinished today doesn't break it either.
 */
export function calculateCurrentStreak(
  completions: CompletionRecord[],
  referenceDate: Date = new Date(),
  tasks?: TaskRecord[]
): number {
  if (!completions || completions.length === 0) return 0;
  const safeRefDate = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();

  const completedDates = new Set<string>();
  for (const c of completions) {
    if (c && c.completed && c.date) {
      completedDates.add(c.date);
    }
  }

  let streak = 0;
  for (let i = 0; i < MAX_HISTORY_DAYS; i++) {
    const day = subDays(safeRefDate, i);
    const dateStr = format(day, "yyyy-MM-dd");
    if (completedDates.has(dateStr)) {
      streak += 1;
      continue;
    }
    if (i === 0) continue; // today isn't over yet
    if (tasks && !tasks.some((t) => isHabitScheduledOn(t, day))) continue; // rest day
    break;
  }

  return streak;
}

/**
 * Calculates the best streak ever recorded (same day rules as calculateCurrentStreak).
 */
export function calculateBestStreak(completions: CompletionRecord[], tasks?: TaskRecord[]): number {
  if (!completions || completions.length === 0) return 0;

  const completedDates = Array.from(
    new Set(completions.filter((c) => c && c.completed && c.date).map((c) => c.date))
  ).sort();

  if (completedDates.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < completedDates.length; i++) {
    const prev = parseISO(completedDates[i - 1]);
    const curr = parseISO(completedDates[i]);
    const diff = differenceInCalendarDays(curr, prev);

    // Days in between only break the streak if a habit was scheduled on one of them
    let broken = diff > 1;
    if (broken && tasks && diff <= MAX_HISTORY_DAYS) {
      broken = false;
      for (let d = 1; d < diff; d++) {
        const between = addDays(prev, d);
        if (tasks.some((t) => isHabitScheduledOn(t, between))) {
          broken = true;
          break;
        }
      }
    }

    if (!broken) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;
  }

  return maxStreak;
}

/**
 * Calculates current consecutive streak for a specific habit / task: consecutive scheduled
 * occurrences completed. Unscheduled days (week-ends of a Lun-Ven habit, other days of a weekly
 * habit) are skipped. Without `task`, every day counts as scheduled.
 */
export function calculateHabitStreak(
  taskId: string,
  completions: CompletionRecord[],
  referenceDate: Date = new Date(),
  task?: TaskRecord
): number {
  if (!completions || completions.length === 0 || !taskId) return 0;
  const safeRefDate = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();

  const taskCompletedDates = new Set<string>();
  for (const c of completions) {
    if (c && c.taskId === taskId && c.completed && c.date) {
      taskCompletedDates.add(c.date);
    }
  }

  const startDate = task ? toDateStr(task.createdAt) : null;
  let streak = 0;
  for (let i = 0; i < MAX_HISTORY_DAYS; i++) {
    const day = subDays(safeRefDate, i);
    const dateStr = format(day, "yyyy-MM-dd");
    if (taskCompletedDates.has(dateStr)) {
      streak += 1;
      continue;
    }
    if (startDate && dateStr < startDate) break;
    if (i === 0) continue; // today isn't over yet
    if (task && !isHabitScheduledOn(task, day)) continue;
    break;
  }

  return streak;
}

function calculateBestHabitStreak(task: TaskRecord, completions: CompletionRecord[], referenceDate: Date): number {
  const doneDates = new Set(
    completions.filter((c) => c.taskId === task.id && c.completed && c.date).map((c) => c.date)
  );
  if (doneDates.size === 0) return 0;
  const { start } = getPeriodRange("all", referenceDate, [task]);
  const firstDone = Array.from(doneDates).sort()[0];
  const from = parseISO(firstDone) < start ? parseISO(firstDone) : start;
  let best = 0;
  let current = 0;
  for (const day of eachDay(from, referenceDate)) {
    const dateStr = format(day, "yyyy-MM-dd");
    if (doneDates.has(dateStr)) {
      current += 1;
      best = Math.max(best, current);
    } else if (isHabitScheduledOn(task, day) && dateStr !== format(referenceDate, "yyyy-MM-dd")) {
      current = 0;
    }
  }
  return best;
}

/**
 * Calculates habit streak statistics and rolling 7 days status per task
 */
export function calculateHabitStreakStats(
  tasks: TaskRecord[],
  completions: CompletionRecord[],
  referenceDate: Date = new Date()
): HabitStreakStat[] {
  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter((t): t is TaskRecord => Boolean(t && t.id));
  const safeCompletions = (Array.isArray(completions) ? completions : []).filter((c): c is CompletionRecord => Boolean(c && c.taskId));
  const safeRefDate = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();

  return safeTasks.map((task) => {
    const currentStreak = calculateHabitStreak(task.id, safeCompletions, safeRefDate, task);

    // Calculate rolling 7 days (from 6 days ago to today)
    const rolling7Days: HabitRollingDay[] = [];
    let scheduledCount = 0;
    let completedCount = 0;

    for (let i = 6; i >= 0; i--) {
      const d = subDays(safeRefDate, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayName = FRENCH_DAYS[d.getDay()];

      const isScheduled = isHabitScheduledOn(task, d);

      const isCompleted = safeCompletions.some(
        (c) => c.taskId === task.id && c.date === dateStr && c.completed
      );

      if (isScheduled) scheduledCount++;
      if (isScheduled && isCompleted) completedCount++;

      rolling7Days.push({
        date: dateStr,
        dayName,
        isScheduled,
        isCompleted,
      });
    }

    const completionRate7Days = ratio(completedCount, scheduledCount);

    return {
      taskId: task.id,
      taskTitle: task.title || "Habitude",
      category: (task as any).tag || task.category || "General",
      currentStreak,
      bestStreak: Math.max(currentStreak, calculateBestHabitStreak(task, safeCompletions, safeRefDate)),
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
  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter((t): t is TaskRecord => Boolean(t && t.id));
  const safeCompletions = (Array.isArray(completions) ? completions : []).filter((c): c is CompletionRecord => Boolean(c && c.taskId));
  const safeEndDate = endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate : new Date();
  const result: DayStatus[] = [];

  for (let i = 6; i >= 0; i--) {
    const dateObj = subDays(safeEndDate, i);
    const dateStr = format(dateObj, "yyyy-MM-dd");
    const dayName = FRENCH_DAYS[dateObj.getDay()];

    const { scheduled: totalScheduled, completed: completedCount } = getDayCounts(
      safeTasks,
      getCompletedKeys(safeCompletions),
      dateObj
    );

    const completionPercentage = ratio(completedCount, totalScheduled);

    let status: "completed" | "missed" | "empty" = "empty";
    if (totalScheduled > 0) {
      status = completedCount > 0 ? "completed" : "missed";
    }

    result.push({
      date: dateStr,
      dayName,
      completedCount,
      totalScheduled,
      completionPercentage,
      isAllCompleted: totalScheduled > 0 && completedCount >= totalScheduled,
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
  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter((t): t is TaskRecord => Boolean(t && t.id));
  const safeCompletions = (Array.isArray(completions) ? completions : []).filter((c): c is CompletionRecord => Boolean(c && c.taskId));
  const safeRefDate = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();

  // Dashboard only tracks recurring habits (one-shot tasks are measured by project goals);
  // archived habits are hidden everywhere, so they don't count either.
  const recurringTasks = safeTasks.filter((t) => t.recurrence && t.recurrence !== "ONCE" && !t.isArchived);
  const recurringTaskIds = new Set(recurringTasks.map((t) => t.id));
  const recurringCompletions = safeCompletions.filter((c) => recurringTaskIds.has(c.taskId));
  const completedKeys = getCompletedKeys(recurringCompletions);

  const habitStreaks = calculateHabitStreakStats(recurringTasks, recurringCompletions, safeRefDate);
  const last7DaysStatus = calculateLast7DaysStatus(recurringTasks, recurringCompletions, safeRefDate);

  // Period = same calendar range as goals (day / Mon–Sun week / month / all), up to the reference date
  const sumRange = (start: Date, end: Date) => {
    let scheduled = 0;
    let completed = 0;
    for (const day of eachDay(start, end)) {
      const counts = getDayCounts(recurringTasks, completedKeys, day);
      scheduled += counts.scheduled;
      completed += counts.completed;
    }
    return { scheduled, completed };
  };

  const range = getPeriodRange(period, safeRefDate, recurringTasks);
  const { scheduled: totalScheduledInPeriod, completed: totalCompletedInPeriod } = sumRange(range.start, range.end);
  const completionRate = ratio(totalCompletedInPeriod, totalScheduledInPeriod);

  const globalStreak = calculateCurrentStreak(recurringCompletions, safeRefDate, recurringTasks);
  const bestGlobalStreak = calculateBestStreak(recurringCompletions, recurringTasks);

  return {
    completionRate,
    currentStreak: globalStreak,
    bestStreak: Math.max(bestGlobalStreak, globalStreak),
    last7DaysStatus,
    habitStreaks,
  };
}
