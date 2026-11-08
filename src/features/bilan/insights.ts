import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type { Task, TaskCompletion } from "@/features/tasks/types";
import type { Goal, GoalPeriodType, GoalProgressResult } from "@/features/goals/types";
import type { ExternalCalendarEvent } from "@/features/calendar/types";
import type { Period } from "@/features/dashboard/types";
import type { DailySleepLog } from "@/features/sleep/types";
import type { HabitStreakStat } from "@/features/analytics/types";
import { isHabitScheduledOn } from "@/features/analytics/calculations";
import { isSleepOrNapTitle } from "@/features/sleep/taskSleepSync";
import { getCompletionMinutes, getDefaultTaskDurationMinutes, minutesBetween } from "@/features/tasks/durationRules";

const dateStr = (d: Date) => format(d, "yyyy-MM-dd");

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

export function periodBounds(type: GoalPeriodType, reference: Date): { start: Date; end: Date } {
  if (type === "day") return { start: startOfDay(reference), end: endOfDay(reference) };
  if (type === "week") {
    return {
      start: startOfWeek(reference, { weekStartsOn: 1 }),
      end: endOfDay(endOfWeek(reference, { weekStartsOn: 1 })),
    };
  }
  return { start: startOfMonth(reference), end: endOfDay(endOfMonth(reference)) };
}

function previousReference(type: GoalPeriodType, reference: Date): Date {
  if (type === "day") return subDays(reference, 1);
  if (type === "week") return subWeeks(reference, 1);
  return subMonths(reference, 1);
}

const WAKING_START_HOUR = 7;
const WAKING_END_HOUR = 23;

function dayFractionElapsed(now: Date): number {
  const hour = now.getHours() + now.getMinutes() / 60;
  return Math.min(1, Math.max(0, (hour - WAKING_START_HOUR) / (WAKING_END_HOUR - WAKING_START_HOUR)));
}

/** How much of the period is behind us: 0 before it starts, 1 once it's over. */
export function periodElapsedFraction(type: GoalPeriodType, reference: Date, now: Date): number {
  const { start, end } = periodBounds(type, reference);
  if (now < start) return 0;
  if (now > end) return 1;
  if (type === "day") return dayFractionElapsed(now);
  const totalDays = differenceInCalendarDays(end, start) + 1;
  const dayIndex = differenceInCalendarDays(now, start);
  return (dayIndex + dayFractionElapsed(now)) / totalDays;
}

/* ------------------------------------------------------------------ */
/* Goal pace                                                           */
/* ------------------------------------------------------------------ */

export type PaceStatus = "done" | "ahead" | "on_track" | "behind" | "missed" | "upcoming";

export interface GoalPace {
  status: PaceStatus;
  /** Where the user should be by now (0–100), i.e. the share of the period already elapsed */
  expectedPercent: number;
  /** What's left to do, in minutes (duration goals) or sessions (count goals) */
  remaining: number;
  /** What it takes per remaining day to finish in time (null for a one-day goal / over period) */
  perDay: number | null;
  daysLeft: number;
  isCount: boolean;
}

const PACE_TOLERANCE = 10;

export function goalPace(
  goal: Pick<Goal, "periodType" | "targetType">,
  progress: GoalProgressResult,
  reference: Date,
  now: Date,
): GoalPace {
  const type = goal.periodType;
  const isCount = goal.targetType === "count";
  const elapsed = periodElapsedFraction(type, reference, now);
  const expectedPercent = Math.round(elapsed * 100);
  const remaining = isCount
    ? Math.max(0, (progress.targetCount || 0) - (progress.actualCount || 0))
    : Math.max(0, progress.targetMinutes - progress.actualMinutes);

  const { start, end } = periodBounds(type, reference);
  const daysLeft = now > end ? 0 : now < start ? differenceInCalendarDays(end, start) + 1 : differenceInCalendarDays(end, now) + 1;
  const perDay = type === "day" || daysLeft === 0 ? null : remaining / daysLeft;

  let status: PaceStatus;
  if (progress.isCompleted) status = "done";
  else if (elapsed >= 1) status = "missed";
  else if (elapsed === 0) status = "upcoming";
  else if (progress.percentage >= expectedPercent + PACE_TOLERANCE) status = "ahead";
  else if (progress.percentage >= expectedPercent - PACE_TOLERANCE) status = "on_track";
  else status = "behind";

  return { status, expectedPercent, remaining, perDay, daysLeft, isCount };
}

/** Riskiest first: behind, missed, on track, upcoming, ahead, done — then the least advanced. */
const RISK_ORDER: Record<PaceStatus, number> = { behind: 0, missed: 1, on_track: 2, upcoming: 3, ahead: 4, done: 5 };

export function sortByRisk<T extends { pace: GoalPace; progress: GoalProgressResult }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => RISK_ORDER[a.pace.status] - RISK_ORDER[b.pace.status] || a.progress.percentage - b.progress.percentage,
  );
}

export interface GoalInsightItem {
  goalId: string;
  name: string;
  targetType: "duration" | "count";
  pace: GoalPace;
}

export interface GoalsVerdict {
  total: number;
  done: number;
  /** Done, ahead, on track or not started yet */
  onTrack: number;
  behind: number;
  /** The one goal worth acting on now, with a session length that would help */
  focus: { goalId: string; name: string; remainingMinutes: number; suggestedMinutes: number; behind: boolean } | null;
}

function roundUpTo15(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

export function goalsVerdict(items: GoalInsightItem[]): GoalsVerdict {
  const done = items.filter((i) => i.pace.status === "done").length;
  const behindItems = items.filter((i) => i.pace.status === "behind" || i.pace.status === "missed");
  const onTrack = items.filter((i) => ["done", "ahead", "on_track", "upcoming"].includes(i.pace.status)).length;

  // Time-based goals can be turned into a session; pick the biggest gap, late goals first
  const candidates = items.filter(
    (i) => i.targetType === "duration" && i.pace.status !== "done" && i.pace.status !== "missed" && i.pace.remaining > 0,
  );
  const late = candidates.filter((i) => i.pace.status === "behind");
  const pool = (late.length > 0 ? late : candidates.filter((i) => i.pace.status === "on_track")).sort(
    (a, b) => b.pace.remaining - a.pace.remaining,
  );
  const top = pool[0];
  const focus = top
    ? {
        goalId: top.goalId,
        name: top.name,
        remainingMinutes: Math.round(top.pace.remaining),
        suggestedMinutes: Math.max(
          15,
          Math.min(240, roundUpTo15(Math.max(30, top.pace.perDay ?? top.pace.remaining)), roundUpTo15(top.pace.remaining)),
        ),
        behind: top.pace.status === "behind",
      }
    : null;

  return { total: items.length, done, onTrack, behind: behindItems.length, focus };
}

/* ------------------------------------------------------------------ */
/* Time per project and change vs the previous period                  */
/* ------------------------------------------------------------------ */

export const NO_PROJECT_KEY = "__none__";

export function completionMinutes(c: TaskCompletion, task: Task | undefined): number {
  return (
    getCompletionMinutes(c) ??
    (minutesBetween(c.scheduledStartTime, c.scheduledEndTime) || null) ??
    (minutesBetween(task?.startTime, task?.endTime) || null) ??
    getDefaultTaskDurationMinutes(task)
  );
}

export interface TimeData {
  tasks: Task[];
  completions: TaskCompletion[];
  externalEvents?: ExternalCalendarEvent[];
}

/** Minutes of completed work per project (key = project id, or NO_PROJECT_KEY) in [start, end]. */
export function projectMinutesInRange(data: TimeData, start: Date, end: Date): Map<string, number> {
  const from = dateStr(start);
  const to = dateStr(end);
  const tasksById = new Map(data.tasks.map((t) => [t.id, t]));
  const totals = new Map<string, number>();
  const add = (key: string, minutes: number) => totals.set(key, (totals.get(key) || 0) + minutes);

  for (const c of data.completions) {
    if (!c.completed || c.date < from || c.date > to) continue;
    const task = tasksById.get(c.taskId);
    if (!task || isSleepOrNapTitle(task.title)) continue;
    add(task.projectId || NO_PROJECT_KEY, completionMinutes(c, task));
  }
  for (const e of data.externalEvents || []) {
    if (!e.projectId || e.date < from || e.date > to) continue;
    add(e.projectId, minutesBetween(e.startTime, e.endTime) || getDefaultTaskDurationMinutes(null));
  }
  return totals;
}

export interface TimeDelta {
  key: string;
  minutes: number;
  previousMinutes: number | null;
  deltaMinutes: number | null;
}

export interface TimeDeltas {
  totalMinutes: number;
  previousTotalMinutes: number | null;
  rows: TimeDelta[];
}

export function timeDeltas(data: TimeData, period: Period, reference: Date): TimeDeltas {
  let current: Map<string, number>;
  let previous: Map<string, number> | null = null;

  if (period === "all") {
    current = projectMinutesInRange(data, new Date(2000, 0, 1), reference);
  } else {
    const { start, end } = periodBounds(period, reference);
    current = projectMinutesInRange(data, start, end);
    const prev = periodBounds(period, previousReference(period, reference));
    previous = projectMinutesInRange(data, prev.start, prev.end);
  }

  const keys = new Set([...current.keys(), ...(previous ? previous.keys() : [])]);
  const rows: TimeDelta[] = Array.from(keys)
    .map((key) => {
      const minutes = Math.round(current.get(key) || 0);
      const previousMinutes = previous ? Math.round(previous.get(key) || 0) : null;
      return { key, minutes, previousMinutes, deltaMinutes: previousMinutes === null ? null : minutes - previousMinutes };
    })
    .filter((r) => r.minutes > 0 || (r.previousMinutes ?? 0) > 0)
    .sort((a, b) => b.minutes - a.minutes);

  return {
    totalMinutes: rows.reduce((s, r) => s + r.minutes, 0),
    previousTotalMinutes: previous ? rows.reduce((s, r) => s + (r.previousMinutes || 0), 0) : null,
    rows,
  };
}

/* ------------------------------------------------------------------ */
/* Habits at risk today                                                */
/* ------------------------------------------------------------------ */

export interface HabitAtRisk {
  taskId: string;
  title: string;
  streak: number;
}

/** Scheduled today, not done yet, with a streak that would reset tomorrow. */
export function habitsAtRisk(habitStreaks: HabitStreakStat[], today: Date): HabitAtRisk[] {
  const todayStr = dateStr(today);
  return habitStreaks
    .filter((h) => {
      const day = (h.rolling7Days || []).find((d) => d.date === todayStr);
      return Boolean(day?.isScheduled && !day.isCompleted && (h.currentStreak ?? 0) >= 1);
    })
    .map((h) => ({ taskId: h.taskId, title: h.taskTitle, streak: h.currentStreak }))
    .sort((a, b) => b.streak - a.streak);
}

/* ------------------------------------------------------------------ */
/* Planned vs done                                                     */
/* ------------------------------------------------------------------ */

export interface PlannedVsDone {
  planned: number;
  done: number;
  /** 0–100, null when nothing was planned */
  rate: number | null;
  /** One-off tasks still waiting from earlier days (they are carried over to today) */
  carriedOver: number;
}

function onceTaskDate(task: Task): string {
  return (task as Task & { date?: string }).date || task.createdAt?.split("T")[0] || "";
}

export function plannedVsDone(
  data: { tasks: Task[]; completions: TaskCompletion[] },
  period: Period,
  reference: Date,
  today: Date,
): PlannedVsDone {
  const todayStr = dateStr(today);
  const range = period === "all" ? { start: subDays(today, 29), end: today } : periodBounds(period, reference);
  const last = range.end > today ? today : range.end;
  const tasks = data.tasks.filter((t) => !t.isArchived && !isSleepOrNapTitle(t.title));
  const doneKeys = new Set(data.completions.filter((c) => c.completed).map((c) => `${c.taskId}|${c.date}`));

  let planned = 0;
  let done = 0;
  for (let day = startOfDay(range.start); day <= last; day = addDays(day, 1)) {
    const ds = dateStr(day);
    for (const t of tasks) {
      const scheduled =
        t.recurrence === "ONCE"
          ? onceTaskDate(t) === ds
          : isHabitScheduledOn(
              {
                id: t.id,
                title: t.title,
                category: t.category,
                recurrence: t.recurrence,
                recurrenceConfig: t.recurrenceConfig,
                trackingType: t.trackingType,
                createdAt: t.createdAt,
                dateOverrides: t.dateOverrides,
                isArchived: t.isArchived,
              },
              day,
            );
      if (!scheduled) continue;
      planned += 1;
      if (doneKeys.has(`${t.id}|${ds}`)) done += 1;
    }
  }

  const completedOnce = new Set(data.completions.filter((c) => c.completed).map((c) => c.taskId));
  const carriedOver = tasks.filter(
    (t) => t.recurrence === "ONCE" && onceTaskDate(t) !== "" && onceTaskDate(t) < todayStr && !completedOnce.has(t.id),
  ).length;

  return { planned, done, rate: planned > 0 ? Math.round((done / planned) * 100) : null, carriedOver };
}

/* ------------------------------------------------------------------ */
/* Sleep regularity                                                    */
/* ------------------------------------------------------------------ */

export interface SleepRegularity {
  nights: number;
  avgDurationMinutes: number;
  /** Standard deviation of the bedtime / wake-up, in minutes */
  bedtimeSpreadMinutes: number;
  wakeSpreadMinutes: number;
  verdict: "very_regular" | "regular" | "irregular";
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function stdDev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

/** Only nights with a recorded (validated) bedtime AND wake-up count. */
export function sleepRegularity(logs: DailySleepLog[], until: Date, days = 14): SleepRegularity | null {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const bedOffsets: number[] = []; // minutes since 18:00 so 23:00 and 01:00 sit on one scale
  const wakes: number[] = [];
  const durations: number[] = [];

  for (let i = 0; i < days; i++) {
    const day = subDays(until, i);
    const log = byDate.get(dateStr(day));
    const eve = byDate.get(dateStr(subDays(day, 1)));
    if (!log?.wakeTimeValidated || !log.wakeTime) continue;

    let bedtime: string | null = null;
    if (eve?.bedtimeValidated && eve.bedtime && toMinutes(eve.bedtime) >= 18 * 60) bedtime = eve.bedtime;
    else if (log.bedtimeValidated && log.bedtime && toMinutes(log.bedtime) < 12 * 60) bedtime = log.bedtime;
    if (!bedtime) continue;

    const bed = toMinutes(bedtime);
    const wake = toMinutes(log.wakeTime);
    const duration = (wake - bed + 24 * 60) % (24 * 60);
    if (duration < 60 || duration > 18 * 60) continue;
    bedOffsets.push(bed >= 18 * 60 ? bed - 18 * 60 : bed + 6 * 60);
    wakes.push(wake);
    durations.push(duration);
  }

  if (durations.length < 3) return null;
  const bedtimeSpread = Math.round(stdDev(bedOffsets));
  const wakeSpread = Math.round(stdDev(wakes));
  const worst = Math.max(bedtimeSpread, wakeSpread);
  return {
    nights: durations.length,
    avgDurationMinutes: Math.round(durations.reduce((s, v) => s + v, 0) / durations.length),
    bedtimeSpreadMinutes: bedtimeSpread,
    wakeSpreadMinutes: wakeSpread,
    verdict: worst <= 30 ? "very_regular" : worst <= 60 ? "regular" : "irregular",
  };
}

/* ------------------------------------------------------------------ */
/* Best hours                                                          */
/* ------------------------------------------------------------------ */

export interface FocusHours {
  /** Minutes of work finished in each hour of the day (index = hour) */
  minutesByHour: number[];
  totalMinutes: number;
  sessions: number;
  /** The 3 consecutive hours holding the most work */
  best: { startHour: number; endHour: number; sharePercent: number } | null;
}

export function focusByHour(
  data: { tasks: Task[]; completions: TaskCompletion[] },
  today: Date,
  sinceDays = 60,
): FocusHours {
  const since = dateStr(subDays(today, sinceDays));
  const sleepIds = new Set(data.tasks.filter((t) => isSleepOrNapTitle(t.title)).map((t) => t.id));
  const minutesByHour = new Array<number>(24).fill(0);
  let sessions = 0;

  for (const c of data.completions) {
    if (!c.completed || c.date < since || !c.actualStartTime || !c.actualEndTime || sleepIds.has(c.taskId)) continue;
    const start = toMinutes(c.actualStartTime);
    let end = toMinutes(c.actualEndTime);
    if (end <= start) end += 24 * 60;
    if (end - start > 8 * 60) continue; // a 12h "session" is a forgotten timer, not focus
    sessions += 1;
    for (let m = start; m < end; ) {
      const hour = Math.floor(m / 60);
      const next = Math.min(end, (hour + 1) * 60);
      minutesByHour[hour % 24] += next - m;
      m = next;
    }
  }

  const totalMinutes = minutesByHour.reduce((s, v) => s + v, 0);
  let best: FocusHours["best"] = null;
  if (sessions >= 5 && totalMinutes >= 120) {
    let bestSum = -1;
    let bestStart = 0;
    for (let h = 0; h <= 21; h++) {
      const sum = minutesByHour[h] + minutesByHour[h + 1] + minutesByHour[h + 2];
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = h;
      }
    }
    best = { startHour: bestStart, endHour: bestStart + 3, sharePercent: Math.round((bestSum / totalMinutes) * 100) };
  }
  return { minutesByHour, totalMinutes, sessions, best };
}

