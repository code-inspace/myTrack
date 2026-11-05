/** One-tap work timer: what is being tracked, plus the pure rules around it. */
export interface QuickTarget {
  /** Goal id, or "project:<id>" when there is no goal */
  key: string;
  label: string;
  projectId: string;
  projectCategory?: string | null;
  color?: string | null;
}

export interface QuickTimerState extends QuickTarget {
  startedAtMs: number;
}

export const MINUTE_MS = 60_000;
/** Beyond this the timer was probably forgotten: ask how long it really was */
export const FORGOTTEN_AFTER_MINUTES = 120;
/** Under a minute is a mis-tap, not work */
export const MIN_LOGGED_MINUTES = 1;
export const MAX_LOGGED_MINUTES = 12 * 60;

export function elapsedMinutes(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / MINUTE_MS));
}

export function looksForgotten(startedAtMs: number, nowMs: number): boolean {
  return elapsedMinutes(startedAtMs, nowMs) >= FORGOTTEN_AFTER_MINUTES;
}

/** A duration typed by the user, kept within what can be a single work block. */
export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_LOGGED_MINUTES, Math.max(0, Math.round(value)));
}

/** "12:34" for a running timer, "1:05:09" past the hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * The block to record for a stop at `endMs`: it never starts before the day it ends on, so a
 * timer left running past midnight is logged on the day of its end (HH:mm math stays valid).
 */
export function blockToLog(startedAtMs: number, endMs: number, minutes: number) {
  const dayStart = new Date(endMs);
  dayStart.setHours(0, 0, 0, 0);
  const durationMs = clampMinutes(minutes) * MINUTE_MS;
  const start = Math.max(dayStart.getTime(), endMs - durationMs);
  return { startMs: start, endMs, minutes: Math.max(1, Math.round((endMs - start) / MINUTE_MS)), startedAtMs };
}

const KEY = "mytrack_quick_timer_v1_";

export function loadQuickTimer(userId: string): QuickTimerState | null {
  try {
    const raw = localStorage.getItem(KEY + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickTimerState;
    return parsed && typeof parsed.startedAtMs === "number" && parsed.projectId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveQuickTimer(userId: string, state: QuickTimerState | null) {
  try {
    if (state) localStorage.setItem(KEY + userId, JSON.stringify(state));
    else localStorage.removeItem(KEY + userId);
  } catch {
    // storage unavailable: the timer still runs in memory
  }
}
