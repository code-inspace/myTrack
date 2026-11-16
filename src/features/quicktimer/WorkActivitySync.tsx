"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/providers/ToastProvider";
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { looksForgotten } from "./quickTimer";
import { useQuickTimer } from "./useQuickTimer";

const WORK_PREFIX = "work:";

/**
 * Mirrors the one-tap work timer on iOS: a Live Activity (lock screen + Dynamic Island) and the
 * home/lock-screen widgets, and handles the "Terminer" button they offer.
 * Renders nothing; it only exists on the native app (the bridge is a no-op elsewhere).
 */
export function WorkActivitySync() {
  const router = useRouter();
  const { toast: showToast } = useToast();
  const { timer, stop } = useQuickTimer();
  const shownId = useRef<string | null>(null);

  const key = timer?.key ?? null;
  const startedAtMs = timer?.startedAtMs ?? null;
  const label = timer?.label ?? "";
  const color = timer?.color ?? undefined;

  useEffect(() => {
    if (!LiveActivityBridge.isSupported()) return;
    let cancelled = false;

    const sync = async () => {
      const wantedId = key && startedAtMs ? WORK_PREFIX + key : null;
      const previous = shownId.current;
      if (previous && previous !== wantedId) {
        shownId.current = null;
        await LiveActivityBridge.stopActivity(previous);
      }
      if (cancelled) return;

      if (wantedId && startedAtMs) {
        shownId.current = wantedId;
        await LiveActivityBridge.startActivity(
          { taskId: wantedId, taskTitle: label, category: "Travail", projectColor: color, projectName: label },
          {
            currentStatus: "WORK",
            startedAtTimestamp: startedAtMs / 1000,
            elapsedSeconds: 0,
            subtitle: "Session de travail",
            progress: 0,
          },
        );
        return;
      }

      // No timer: clear a work session left behind (app killed, timer stopped elsewhere)
      if (!previous) {
        const info = await LiveActivityBridge.getActiveTask();
        const stale = (info.activeTasks ?? []).filter((t) => t.taskId?.startsWith(WORK_PREFIX));
        for (const t of stale) await LiveActivityBridge.stopActivity(t.taskId);
      }
    };

    sync().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, startedAtMs, label, color]);

  useEffect(() => {
    const onStop = () => {
      if (!timer) return;
      if (looksForgotten(timer.startedAtMs, Date.now())) {
        showToast({ message: "Le chrono tourne depuis longtemps : arrête-le ici pour choisir la durée." });
        router.push("/");
        return;
      }
      stop();
    };
    window.addEventListener("mytrack:work-stop", onStop);
    return () => window.removeEventListener("mytrack:work-stop", onStop);
  }, [timer, stop, router, showToast]);

  return null;
}
