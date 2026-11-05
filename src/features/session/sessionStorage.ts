import type { SessionState } from "./types";

const KEY = "mytrack_session_v1_";

export function loadSession(userId: string): SessionState | null {
  try {
    const raw = localStorage.getItem(KEY + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    return parsed && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(userId: string, state: SessionState | null) {
  try {
    if (state) localStorage.setItem(KEY + userId, JSON.stringify(state));
    else localStorage.removeItem(KEY + userId);
  } catch {
    // storage unavailable: the session still runs in memory
  }
}
