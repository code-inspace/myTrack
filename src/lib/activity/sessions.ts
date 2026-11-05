/**
 * Pure rules of automatic activity tracking. A source (a folder opened in Claude Code, an app)
 * sends pings; consecutive pings closer than the idle window belong to the same work session.
 */

export type ActivityOrigin = "claude-code" | "web";
export type ActivityEvent = "ping" | "end";

/** Silence after which a session is considered over. Claude Code is quiet while you read/think. */
export const IDLE_WINDOW_MS: Record<ActivityOrigin, number> = {
  "claude-code": 15 * 60_000,
  web: 3 * 60_000,
};

export interface OpenSession {
  startedAt: Date;
  lastPingAt: Date;
  seconds: number;
  creditedMinutes: number;
}

export interface PingOutcome {
  /** Whether the previous open session must be closed (idle) before this ping starts a new one. */
  closePrevious: boolean;
  /** Seconds this ping adds to the session it belongs to. */
  addSeconds: number;
  /** Total seconds of the session after this ping. */
  totalSeconds: number;
  /** Whole minutes still to credit to the task (never negative). */
  minutesToCredit: number;
  /** Whole minutes credited so far, after this ping. */
  creditedMinutes: number;
}

export function isValidOrigin(value: unknown): value is ActivityOrigin {
  return value === "claude-code" || value === "web";
}

/**
 * Where `now` falls relative to the open session (if any): continue it, or close it at its last
 * ping and start a new one. The gap is only counted as work when it is inside the idle window.
 */
export function evaluatePing(open: OpenSession | null, now: Date, origin: ActivityOrigin): PingOutcome {
  const idle = IDLE_WINDOW_MS[origin];
  if (!open) {
    return { closePrevious: false, addSeconds: 0, totalSeconds: 0, minutesToCredit: 0, creditedMinutes: 0 };
  }
  const gap = now.getTime() - open.lastPingAt.getTime();
  if (gap > idle) {
    return {
      closePrevious: true,
      addSeconds: 0,
      totalSeconds: 0,
      minutesToCredit: 0,
      creditedMinutes: 0,
    };
  }
  const addSeconds = Math.max(0, Math.round(gap / 1000));
  const totalSeconds = open.seconds + addSeconds;
  const wholeMinutes = Math.round(totalSeconds / 60);
  return {
    closePrevious: false,
    addSeconds,
    totalSeconds,
    minutesToCredit: Math.max(0, wholeMinutes - open.creditedMinutes),
    creditedMinutes: Math.max(open.creditedMinutes, wholeMinutes),
  };
}

/** A key like "my-app" from a folder name or an app id; null if it can't be a usable key. */
export function normalizeSourceKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return key.length > 0 ? key : null;
}
