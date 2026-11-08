import { addDays, format, getDay, startOfWeek } from "date-fns";
import { completionMinutes, type TimeData } from "@/features/bilan/insights";
import { isSleepOrNapTitle } from "@/features/sleep/taskSleepSync";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export interface FocusSettings {
  /** Why it matters: shown at the top of the home screen */
  stakeText: string;
  /** YYYY-MM-DD, optional (a countdown is shown when set) */
  stakeDate: string;
  /** Minutes of tracked work expected per working day, 0 = no daily target */
  dailyTargetMinutes: number;
  /** Monday to Friday only (weekends neither count nor break the streak) */
  weekdaysOnly: boolean;
  /** Missed days forgiven per week before the streak breaks */
  jokersPerWeek: number;
}

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  stakeText: "",
  stakeDate: "",
  dailyTargetMinutes: 0,
  weekdaysOnly: true,
  jokersPerWeek: 1,
};

const KEY = "mytrack_focus_settings_v1_";

export function loadFocusSettings(userId: string): FocusSettings {
  try {
    const raw = localStorage.getItem(KEY + userId);
    if (!raw) return DEFAULT_FOCUS_SETTINGS;
    const p = JSON.parse(raw) as Partial<FocusSettings>;
    return {
      stakeText: typeof p.stakeText === "string" ? p.stakeText.slice(0, 140) : "",
      stakeDate: typeof p.stakeDate === "string" ? p.stakeDate : "",
      dailyTargetMinutes: Math.max(0, Math.min(16 * 60, Number(p.dailyTargetMinutes) || 0)),
      weekdaysOnly: p.weekdaysOnly !== false,
      jokersPerWeek: Math.max(0, Math.min(3, Math.round(Number(p.jokersPerWeek ?? 1)))),
    };
  } catch {
    return DEFAULT_FOCUS_SETTINGS;
  }
}

export function saveFocusSettings(userId: string, settings: FocusSettings) {
  try {
    localStorage.setItem(KEY + userId, JSON.stringify(settings));
  } catch {
    // storage unavailable: settings stay for this session only
  }
}

/** Whole days from `today` to the stake date; null if no/invalid date, negative once passed. */
export function daysUntil(stakeDate: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stakeDate)) return null;
  const [y, m, d] = stakeDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Tracked work minutes per day (YYYY-MM-DD) for the projects that carry a goal: the time the
 * daily target is about. Sleep is never work.
 */
export function minutesByDate(data: Pick<TimeData, "tasks" | "completions">, projectIds: Set<string>): Map<string, number> {
  const tasksById = new Map(data.tasks.map((t) => [t.id, t]));
  const byDate = new Map<string, number>();
  for (const c of data.completions) {
    if (!c.completed) continue;
    const task = tasksById.get(c.taskId);
    if (!task || !task.projectId || !projectIds.has(task.projectId) || isSleepOrNapTitle(task.title)) continue;
    byDate.set(c.date, (byDate.get(c.date) || 0) + completionMinutes(c, task));
  }
  return byDate;
}

export interface DailyStreak {
  /** Days in the streak (hit days only; forgiven days keep it alive without adding to it) */
  streak: number;
  /** Jokers still available this week */
  jokersLeft: number;
  hitToday: boolean;
  /** Today is not a working day under the weekdays-only rule */
  restDay: boolean;
}

const isWeekend = (d: Date) => getDay(d) === 0 || getDay(d) === 6;

/**
 * Consecutive working days on which the target was reached. Today never breaks the streak while
 * it is still in progress. A missed day is forgiven if the week still has a joker, otherwise the
 * streak ends there.
 */
export function dailyStreak(
  minutes: Map<string, number>,
  settings: Pick<FocusSettings, "dailyTargetMinutes" | "weekdaysOnly" | "jokersPerWeek">,
  today: Date,
  maxDays = 400,
): DailyStreak {
  const target = settings.dailyTargetMinutes;
  const weekKey = (d: Date) => ymd(startOfWeek(d, { weekStartsOn: 1 }));
  const hit = (d: Date) => (minutes.get(ymd(d)) || 0) >= target;
  const skip = (d: Date) => settings.weekdaysOnly && isWeekend(d);

  const restDay = skip(today);
  const hitToday = target > 0 && hit(today);
  if (target <= 0) return { streak: 0, jokersLeft: settings.jokersPerWeek, hitToday: false, restDay };

  // Jokers are spent per week, going backwards from today (today's own miss is not spent yet)
  const used = new Map<string, number>();
  let streak = hitToday ? 1 : 0;
  for (let i = 1; i <= maxDays; i++) {
    const day = addDays(today, -i);
    if (skip(day)) continue;
    if (hit(day)) {
      streak += 1;
      continue;
    }
    const wk = weekKey(day);
    const spent = used.get(wk) || 0;
    if (spent < settings.jokersPerWeek) {
      used.set(wk, spent + 1);
      continue;
    }
    break;
  }

  // Jokers already spent this week = missed working days before today, up to the allowance
  let missedThisWeek = 0;
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  for (let d = monday; ymd(d) < ymd(today); d = addDays(d, 1)) {
    if (!skip(d) && !hit(d)) missedThisWeek += 1;
  }
  return {
    streak,
    jokersLeft: Math.max(0, settings.jokersPerWeek - missedThisWeek),
    hitToday,
    restDay,
  };
}
