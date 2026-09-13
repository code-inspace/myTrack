"use client";

import React, { useEffect } from "react";
import { useTaskMutations } from "@/features/tasks/hooks";
import { getTodayDateString } from "@/lib/dates";

export function DeepLinkProvider({ children }: { children: React.ReactNode }) {
  const { finishTaskExecution } = useTaskMutations();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUrl = (urlString: string) => {
      if (!urlString) return;
      try {
        console.log("[DeepLinkProvider] Received URL:", urlString);
        const url = new URL(urlString.startsWith("mytrack://") ? urlString.replace("mytrack://", "http://mytrack.local/") : urlString);
        
        const isStop = url.pathname.includes("stop-task") || url.pathname.includes("complete-task") || url.hostname === "stop-task" || url.hostname === "complete-task";
        if (isStop) {
          const taskId = url.searchParams.get("id") || url.searchParams.get("taskId");
          if (taskId) {
            console.log("[DeepLinkProvider] Stopping active task from deep link:", taskId);
            const today = getTodayDateString();
            finishTaskExecution.mutate({ taskId, date: today });
          }
        }

        const isNewTask = url.pathname.includes("new-task") || url.pathname.includes("create-task") || url.hostname === "new-task" || url.hostname === "create-task";
        if (isNewTask) {
          window.dispatchEvent(new CustomEvent("mytrack:open-quick-add"));
        }
      } catch (err) {
        console.warn("[DeepLinkProvider] Failed to parse URL:", urlString, err);
      }
    };

    // 1. Capacitor native appUrlOpen listener
    const onAppUrlOpen = (event: any) => {
      const url = event?.detail?.url || event?.url;
      if (url) {
        handleUrl(url);
      }
    };
    window.addEventListener("appUrlOpen", onAppUrlOpen);

    // 2. Custom window event from native bridge
    const onNativeStop = (event: any) => {
      const taskId = event?.detail?.taskId || event?.detail?.id;
      if (taskId) {
        const today = getTodayDateString();
        finishTaskExecution.mutate({ taskId, date: today });
      }
    };
    window.addEventListener("mytrack:stop-task-from-native", onNativeStop);

    // 3. Check initial URL query if launched directly via browser redirect
    if (window.location.search.includes("stop-task") || window.location.search.includes("complete-task")) {
      const params = new URLSearchParams(window.location.search);
      const taskId = params.get("id") || params.get("taskId");
      if (taskId) {
        const today = getTodayDateString();
        finishTaskExecution.mutate({ taskId, date: today });
      }
    }

    return () => {
      window.removeEventListener("appUrlOpen", onAppUrlOpen);
      window.removeEventListener("mytrack:stop-task-from-native", onNativeStop);
    };
  }, [finishTaskExecution]);

  return <>{children}</>;
}
