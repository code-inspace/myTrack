"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { isWarning, remainingMs, sessionReducer, startSession, currentItem } from "./sessionMachine";
import type { SessionAction } from "./sessionMachine";
import { loadSession, saveSession } from "./sessionStorage";
import {
  cancelSessionAlerts,
  completeSessionTask,
  scheduleSessionAlerts,
  setTaskActive,
} from "./sessionEffects";
import { MINUTE_MS } from "./plan";
import type { RunItem, SessionState } from "./types";

type DispatchAction = SessionAction extends infer A ? (A extends { now: number } ? Omit<A, "now"> : never) : never;

/** Runs a session: persisted (survives a reload), timestamp based, and wired to the tasks. */
export function useSessionRunner() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const queryClient = useQueryClient();

  // The page only renders once the user is known (AuthGuard), so the stored session can be read
  // right away: a running session survives a reload or a closed tab.
  const [state, setStateRaw] = useState<SessionState | null>(() =>
    typeof window !== "undefined" && userId ? loadSession(userId) : null,
  );
  const hydrated = Boolean(userId);
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef<SessionState | null>(state);

  const setState = useCallback(
    (next: SessionState | null) => {
      stateRef.current = next;
      setStateRaw(next);
      if (userId) saveSession(userId, next);
    },
    [userId],
  );

  // The countdown is derived from absolute timestamps; this only refreshes the display
  const running = state?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running]);

  const syncAlerts = useCallback((next: SessionState | null, at: number) => {
    const item = next && next.status === "running" ? currentItem(next) : null;
    if (!next || !item || item.kind !== "task" || next.paused) {
      cancelSessionAlerts();
      return;
    }
    const left = remainingMs(next, at);
    const warnAt = Math.min(5 * MINUTE_MS, item.plannedMs / 2);
    scheduleSessionAlerts(item.title, left > warnAt ? left - warnAt : null, left);
  }, []);

  const afterTransition = useCallback(
    (prev: SessionState, next: SessionState, at: number) => {
      const finishedItem: RunItem | undefined = prev.items[prev.index];
      const finishedNow =
        finishedItem && finishedItem.state === "active" && next.items[prev.index]?.state !== "active";
      if (finishedNow) {
        const result = next.items[prev.index];
        setTaskActive(result.taskId, false, userId);
        if (result.state === "done" && result.kind === "task") {
          completeSessionTask(result, userId).finally(() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["completions"] });
          });
        }
      }
      const nowActive = next.status === "running" ? currentItem(next) : null;
      if (nowActive && nowActive.id !== finishedItem?.id) setTaskActive(nowActive.taskId, true, userId);
      syncAlerts(next, at);
    },
    [queryClient, syncAlerts, userId],
  );

  const dispatch = useCallback(
    (action: DispatchAction) => {
      const prev = stateRef.current;
      if (!prev) return;
      const at = Date.now();
      const next = sessionReducer(prev, { ...action, now: at } as SessionAction);
      if (next === prev) return;
      setState(next);
      setNow(at);
      afterTransition(prev, next, at);
    },
    [afterTransition, setState],
  );

  /** Starts running the items (tasks already created / scheduled by the planner). */
  const start = useCallback(
    (items: RunItem[], sessionEndMs: number) => {
      const at = Date.now();
      const next = startSession(items, sessionEndMs, at, `session-${at}`);
      setState(next);
      setNow(at);
      const first = currentItem(next);
      if (first) setTaskActive(first.taskId, true, userId);
      syncAlerts(next, at);
    },
    [setState, syncAlerts, userId],
  );

  /** Clears a finished / cancelled session so a new one can be planned. */
  const clear = useCallback(() => {
    cancelSessionAlerts();
    setState(null);
  }, [setState]);

  const current = state ? currentItem(state) : null;
  return {
    state,
    hydrated,
    now,
    current,
    warning: state ? isWarning(state, now) : false,
    remaining: state ? remainingMs(state, now) : 0,
    dispatch,
    start,
    clear,
  };
}
