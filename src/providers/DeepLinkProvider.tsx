"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTaskMutations } from "@/features/tasks/hooks";
import { getTodayDateString } from "@/lib/dates";

import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export function DeepLinkProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { finishTaskExecution } = useTaskMutations();

  useEffect(() => {
    if (typeof window === "undefined") return;

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

    // 1. Capacitor native App plugin listener
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

    // 2. Window events from native bridge / webview dispatch
    const onAppUrlOpen = (event: any) => {
      const url = event?.detail?.url || event?.url;
      if (url) {
        handleUrl(url);
      }
    };
    window.addEventListener("appUrlOpen", onAppUrlOpen);
    window.addEventListener("mytrack:open-url", onAppUrlOpen);

    // 3. Custom window event from native bridge
    const onNativeStop = (event: any) => {
      const taskId = event?.detail?.taskId || event?.detail?.id;
      if (taskId) {
        const today = getTodayDateString();
        finishTaskExecution.mutate({ taskId, date: today });
      }
    };
    window.addEventListener("mytrack:stop-task-from-native", onNativeStop);

    // 4. Check initial URL query if launched directly via browser redirect
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

    return () => {
      window.removeEventListener("appUrlOpen", onAppUrlOpen);
      window.removeEventListener("mytrack:open-url", onAppUrlOpen);
      window.removeEventListener("mytrack:stop-task-from-native", onNativeStop);
      if (capListenerHandle && typeof capListenerHandle.remove === "function") {
        capListenerHandle.remove();
      }
    };
  }, [finishTaskExecution, router]);

  return <>{children}</>;
}
