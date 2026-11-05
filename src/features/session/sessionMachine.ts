import { MIN_BLOCK_MINUTES, MINUTE_MS } from "./plan";
import type { RunItem, SessionState } from "./types";

export type SessionAction =
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "extend"; now: number; minutes: number }
  | { type: "finish"; now: number }
  | { type: "skip"; now: number }
  | { type: "shift_end"; now: number }
  | { type: "shrink"; now: number }
  | { type: "cancel"; now: number };

export function startSession(items: RunItem[], sessionEndMs: number, now: number, id: string): SessionState {
  const state: SessionState = {
    id,
    createdAtMs: now,
    sessionEndMs,
    items: items.map((i) => ({ ...i })),
    index: -1,
    paused: false,
    pausedAtMs: null,
    status: "running",
  };
  return activateNext(state, now);
}

function activateNext(state: SessionState, now: number): SessionState {
  const next = state.index + 1;
  if (next >= state.items.length) {
    return { ...state, index: state.items.length, status: "finished", paused: false, pausedAtMs: null };
  }
  const items = state.items.map((item, i) =>
    i === next ? { ...item, state: "active" as const, startedAtMs: now, endsAtMs: now + item.plannedMs } : item,
  );
  return { ...state, items, index: next, paused: false, pausedAtMs: null };
}

export function currentItem(state: SessionState): RunItem | null {
  return state.items[state.index] ?? null;
}

/** End of the active item as of `now`, counting a running pause and overtime. */
export function effectiveEndsAt(state: SessionState, now: number): number {
  const item = currentItem(state);
  if (!item || item.endsAtMs === null) return now;
  const pausedExtra = state.paused && state.pausedAtMs !== null ? now - state.pausedAtMs : 0;
  return Math.max(item.endsAtMs + pausedExtra, now);
}

/** Milliseconds left on the active item (negative once over time). */
export function remainingMs(state: SessionState, now: number): number {
  const item = currentItem(state);
  if (!item || item.endsAtMs === null) return 0;
  const pausedExtra = state.paused && state.pausedAtMs !== null ? now - state.pausedAtMs : 0;
  return item.endsAtMs + pausedExtra - now;
}

/** When the session would finish if everything left takes exactly its planned time. */
export function projectedEndMs(state: SessionState, now: number): number {
  if (state.status !== "running") return now;
  const following = state.items.slice(state.index + 1).reduce((sum, i) => sum + i.plannedMs, 0);
  return effectiveEndsAt(state, now) + following;
}

/** How far past the session end the plan is heading (0 when it still fits). */
export function overrunMs(state: SessionState, now: number): number {
  return Math.max(0, projectedEndMs(state, now) - state.sessionEndMs);
}

export interface ShrinkChange {
  itemId: string;
  title: string;
  fromMinutes: number;
  toMinutes: number;
}

export interface ShrinkPlan {
  changes: ShrinkChange[];
  /** What the shrink recovers */
  absorbedMs: number;
  /** What would still run over the session end even after shrinking */
  remainingOverflowMs: number;
}

/**
 * Shrinks the tasks still to come (never below MIN_BLOCK_MINUTES, breaks untouched), spread in
 * proportion to what each can give up.
 */
export function planShrink(state: SessionState, now: number): ShrinkPlan {
  const overflow = overrunMs(state, now);
  const needMinutes = Math.ceil(overflow / MINUTE_MS);
  const candidates = state.items
    .slice(state.index + 1)
    .filter((i) => i.kind === "task" && i.state === "pending")
    .map((i) => ({ item: i, reducible: Math.max(0, Math.floor(i.plannedMs / MINUTE_MS) - MIN_BLOCK_MINUTES) }))
    .filter((c) => c.reducible > 0);

  const totalReducible = candidates.reduce((sum, c) => sum + c.reducible, 0);
  const toRecover = Math.min(needMinutes, totalReducible);

  // Largest-remainder allocation in whole minutes
  const shares = candidates.map((c) => {
    const exact = totalReducible === 0 ? 0 : (toRecover * c.reducible) / totalReducible;
    return { c, base: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let leftover = toRecover - shares.reduce((sum, s) => sum + s.base, 0);
  [...shares].sort((a, b) => b.frac - a.frac).forEach((s) => {
    if (leftover > 0 && s.base < s.c.reducible) {
      s.base += 1;
      leftover -= 1;
    }
  });

  const changes: ShrinkChange[] = shares
    .filter((s) => s.base > 0)
    .map((s) => {
      const fromMinutes = Math.floor(s.c.item.plannedMs / MINUTE_MS);
      return { itemId: s.c.item.id, title: s.c.item.title, fromMinutes, toMinutes: fromMinutes - s.base };
    });
  const absorbedMs = toRecover * MINUTE_MS;
  return { changes, absorbedMs, remainingOverflowMs: Math.max(0, overflow - absorbedMs) };
}

/** True during the last minutes of a task (≤ 5 min, or half the block for short blocks). */
export function isWarning(state: SessionState, now: number): boolean {
  const item = currentItem(state);
  if (!item || item.kind !== "task") return false;
  const remaining = remainingMs(state, now);
  const threshold = Math.min(5 * MINUTE_MS, item.plannedMs / 2);
  return remaining > 0 && remaining <= threshold;
}

function closeActive(state: SessionState, now: number, result: "done" | "skipped"): SessionState {
  const item = currentItem(state);
  if (!item || item.startedAtMs === null) return state;
  const runningPause = state.paused && state.pausedAtMs !== null ? now - state.pausedAtMs : 0;
  const actualMs = Math.max(0, now - item.startedAtMs - item.pausedMs - runningPause);
  const items = state.items.map((it, i) => (i === state.index ? { ...it, state: result, actualMs } : it));
  return { ...state, items };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (state.status !== "running") return state;
  const now = action.now;

  switch (action.type) {
    case "pause":
      return state.paused ? state : { ...state, paused: true, pausedAtMs: now };

    case "resume": {
      if (!state.paused || state.pausedAtMs === null) return state;
      const pausedFor = now - state.pausedAtMs;
      const items = state.items.map((it, i) =>
        i === state.index && it.endsAtMs !== null
          ? { ...it, endsAtMs: it.endsAtMs + pausedFor, pausedMs: it.pausedMs + pausedFor }
          : it,
      );
      return { ...state, items, paused: false, pausedAtMs: null };
    }

    case "extend": {
      const ms = action.minutes * MINUTE_MS;
      const items = state.items.map((it, i) =>
        i === state.index && it.endsAtMs !== null
          ? { ...it, endsAtMs: it.endsAtMs + ms, plannedMs: it.plannedMs + ms }
          : it,
      );
      return { ...state, items };
    }

    case "finish":
      return activateNext(closeActive(state, now, "done"), now);

    case "skip":
      return activateNext(closeActive(state, now, "skipped"), now);

    case "shift_end":
      return { ...state, sessionEndMs: Math.max(state.sessionEndMs, projectedEndMs(state, now)) };

    case "shrink": {
      const plan = planShrink(state, now);
      const byId = new Map(plan.changes.map((c) => [c.itemId, c.toMinutes]));
      const items = state.items.map((it) =>
        byId.has(it.id) ? { ...it, plannedMs: (byId.get(it.id) as number) * MINUTE_MS } : it,
      );
      const next = { ...state, items };
      // What can't be absorbed moves the end instead (announced in the choice)
      return { ...next, sessionEndMs: Math.max(next.sessionEndMs, projectedEndMs(next, now)) };
    }

    case "cancel":
      return { ...closeActive(state, now, "skipped"), status: "cancelled", paused: false, pausedAtMs: null };
  }
}
