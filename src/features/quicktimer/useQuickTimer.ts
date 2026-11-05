"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { deleteDbTask } from "@/features/tasks/actions";
import { formatMinutes } from "@/features/session/plan";
import {
  MIN_LOGGED_MINUTES,
  clampMinutes,
  elapsedMinutes,
  loadQuickTimer,
  saveQuickTimer,
  type QuickTarget,
  type QuickTimerState,
} from "./quickTimer";
import { logWork } from "./logWork";

// Shared by every component (home card, floating pill): one timer, stored per user
const listeners = new Set<() => void>();
let cache: { userId: string; state: QuickTimerState | null } | null = null;

function read(userId: string): QuickTimerState | null {
  if (!userId) return null;
  if (!cache || cache.userId !== userId) cache = { userId, state: loadQuickTimer(userId) };
  return cache.state;
}
function write(userId: string, state: QuickTimerState | null) {
  cache = { userId, state };
  saveQuickTimer(userId, state);
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => {
    cache = null;
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The one-tap work timer: start on a target, stop to record the time, or add time afterwards. */
export function useQuickTimer() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const queryClient = useQueryClient();
  const { toast: showToast } = useToast();

  const timer = useSyncExternalStore(
    subscribe,
    () => read(userId),
    () => null,
  );

  const [now, setNow] = useState(() => Date.now());
  const isRunning = timer !== null;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isRunning]);

  /** Records `minutes` ending now, with an undo that removes the created task. */
  const record = useCallback(
    async (target: QuickTarget, minutes: number, endMs = Date.now()) => {
      const clamped = clampMinutes(minutes);
      if (clamped < MIN_LOGGED_MINUTES || !userId) return false;
      try {
        const { taskId, minutes: logged } = await logWork({ target, endMs, minutes: clamped, userId });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        showToast({
          message: `${formatMinutes(logged)} enregistrées sur ${target.label}`,
          action: {
            label: "Annuler",
            onClick: () => {
              deleteDbTask(taskId, userId)
                .catch(() => {})
                .finally(() => queryClient.invalidateQueries({ queryKey: ["tasks"] }));
            },
          },
        });
        return true;
      } catch (err) {
        console.warn("quick timer record error:", err);
        showToast({ message: "Impossible d'enregistrer le temps. Réessaie." });
        return false;
      }
    },
    [userId, queryClient, showToast],
  );

  /** Stops and records. `minutes` overrides the measured time (forgotten timer). */
  const stop = useCallback(
    async (minutes?: number) => {
      const current = read(userId);
      if (!current) return;
      const measured = elapsedMinutes(current.startedAtMs, Date.now());
      write(userId, null);
      await record(current, minutes ?? measured);
    },
    [userId, record],
  );

  /** Starting another target stops (and records) the one in progress. */
  const start = useCallback(
    async (target: QuickTarget) => {
      if (!userId) return;
      const current = read(userId);
      if (current && current.key === target.key) return;
      if (current) await stop();
      setNow(Date.now());
      write(userId, { ...target, startedAtMs: Date.now() });
    },
    [userId, stop],
  );

  const discard = useCallback(() => {
    if (userId) write(userId, null);
  }, [userId]);

  return { timer, now, start, stop, discard, record };
}
