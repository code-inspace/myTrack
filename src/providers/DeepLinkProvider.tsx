"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTaskMutations } from "@/features/tasks/hooks";
import { useAuth } from "@/providers/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { getTodayDateString } from "@/lib/dates";
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { NativeNotifications } from "@/lib/native/localNotifications";
import type { Task } from "@/features/tasks/types";

import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { initAutoSleepTracking } from "@/features/sleep/autoSleepTracker";

export function DeepLinkProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { startTaskExecution, finishTaskExecution } = useTaskMutations();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncWidgetState = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        const activeInfo = await LiveActivityBridge.getActiveTask();
        const today = getTodayDateString();
        const currentTasks: Task[] =
          queryClient.getQueryData<Task[]>(["tasks", user?.id]) ||
          queryClient.getQueryData<Task[]>(["tasks"]) ||
          [];

        // 1. Si une tâche a été arrêtée depuis le widget
        if (activeInfo.lastStoppedTaskId) {
          const stoppedId = activeInfo.lastStoppedTaskId;
          const isCurrentlyActive = currentTasks.some(
            (t) => t.id === stoppedId && t.isActive
          );
          if (isCurrentlyActive) {
            console.log("[DeepLinkProvider] Stopping task from widget stop intent:", stoppedId);
            finishTaskExecution.mutate({ taskId: stoppedId, date: today });
          }
        }

        // 2. Si une tâche a été démarrée depuis le widget
        if (activeInfo.hasActiveTask && activeInfo.task?.taskId) {
          const startedId = activeInfo.task.taskId;
          const targetTask = currentTasks.find((t) => t.id === startedId);
          if (targetTask && !targetTask.isActive) {
            console.log("[DeepLinkProvider] Starting task from widget start intent:", startedId);
            startTaskExecution.mutate({ taskId: startedId, date: today });
          }
        }
      } catch (err) {
        console.warn("[DeepLinkProvider] Error syncing widget state:", err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Synchronisation au démarrage
    syncWidgetState();

    // Synchronisation quand l'app revient au premier plan
    let capStateHandle: any = null;
    if (Capacitor.isPluginAvailable("App")) {
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          syncWidgetState();
        }
      }).then((handle) => {
        capStateHandle = handle;
      }).catch(() => {});
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncWidgetState();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    const triggerQuickAdd = () => {
      try {
        sessionStorage.setItem("mytrack_focus_quick_add", "1");
        (window as any).__mytrack_focus_quick_add = true;
      } catch {}
      router.push("/tasks");
      window.dispatchEvent(new CustomEvent("mytrack:open-quick-add"));
    };

    const handleUrl = (urlString: string) => {
      if (!urlString) return;
      try {
        console.log("[DeepLinkProvider] Received URL:", urlString);
        const url = new URL(
          urlString.startsWith("mytrack://")
            ? urlString.replace("mytrack://", "http://mytrack.local/")
            : urlString
        );

        const isStop =
          url.pathname.includes("stop-task") ||
          url.pathname.includes("complete-task") ||
          url.hostname === "stop-task" ||
          url.hostname === "complete-task";

        if (isStop) {
          const taskId = url.searchParams.get("id") || url.searchParams.get("taskId");
          if (taskId) {
            console.log("[DeepLinkProvider] Stopping active task from deep link:", taskId);
            const today = getTodayDateString();
            finishTaskExecution.mutate({ taskId, date: today });
          }
          return;
        }

        const isNewTask =
          url.pathname.includes("new-task") ||
          url.pathname.includes("create-task") ||
          url.hostname === "new-task" ||
          url.hostname === "create-task" ||
          url.searchParams.get("action") === "new-task";

        if (isNewTask) {
          triggerQuickAdd();
        }
      } catch (err) {
        console.warn("[DeepLinkProvider] Failed to parse URL:", urlString, err);
      }
    };

    // Capacitor native App plugin listener
    let capListenerHandle: any = null;
    if (Capacitor.isPluginAvailable("App")) {
      CapApp.addListener("appUrlOpen", (data: any) => {
        if (data?.url) {
          handleUrl(data.url);
        }
      }).then((handle) => {
        capListenerHandle = handle;
      }).catch(() => {});

      CapApp.getLaunchUrl().then((launchData) => {
        if (launchData?.url) {
          handleUrl(launchData.url);
        }
      }).catch(() => {});
    }

    // Window events from native bridge / webview dispatch
    const onAppUrlOpen = (event: any) => {
      const url = event?.detail?.url || event?.url;
      if (url) {
        handleUrl(url);
      }
    };
    window.addEventListener("appUrlOpen", onAppUrlOpen);
    window.addEventListener("mytrack:open-url", onAppUrlOpen);

    // Custom window event from native bridge
    const onNativeStop = (event: any) => {
      const taskId = event?.detail?.taskId || event?.detail?.id;
      if (taskId) {
        const today = getTodayDateString();
        finishTaskExecution.mutate({ taskId, date: today });
      }
    };
    window.addEventListener("mytrack:stop-task-from-native", onNativeStop);

    // Check initial URL query if launched directly via browser redirect
    const search = window.location.search;
    if (search.includes("stop-task") || search.includes("complete-task")) {
      const params = new URLSearchParams(search);
      const taskId = params.get("id") || params.get("taskId");
      if (taskId) {
        const today = getTodayDateString();
        finishTaskExecution.mutate({ taskId, date: today });
      }
    }

    if (
      search.includes("new-task") ||
      search.includes("create-task") ||
      search.includes("action=new-task")
    ) {
      triggerQuickAdd();
    }

    // Native local notifications action listener
    const cleanupNotifs = NativeNotifications.setupListeners((extra) => {
      if (extra?.taskId) {
        router.push(`/tasks?taskId=${extra.taskId}`);
      }
    });

    // Automatic sleep tracking based on app lifecycle (open / close / background during night)
    const cleanupAutoSleep = initAutoSleepTracking();

    // Global window scroll lockdown for iOS WebKit
    const lockWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", lockWindowScroll, { passive: true });

    return () => {
      cleanupNotifs();
      cleanupAutoSleep();
      window.removeEventListener("scroll", lockWindowScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
      window.removeEventListener("appUrlOpen", onAppUrlOpen);
      window.removeEventListener("mytrack:open-url", onAppUrlOpen);
      window.removeEventListener("mytrack:stop-task-from-native", onNativeStop);
      if (capStateHandle && typeof capStateHandle.remove === "function") {
        capStateHandle.remove();
      }
      if (capListenerHandle && typeof capListenerHandle.remove === "function") {
        capListenerHandle.remove();
      }
    };
  }, [finishTaskExecution, startTaskExecution, router, user?.id, queryClient]);

  return <>{children}</>;
}
