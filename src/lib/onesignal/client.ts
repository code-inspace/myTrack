"use client";

import OneSignal from "react-onesignal";
import { createClient } from "@/utils/supabase/client";

let isInitialized = false;
let currentSyncedUserId: string | null = null;

export async function initOneSignal(): Promise<void> {
  if (typeof window === "undefined" || isInitialized) return;

  const appId =
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
    "945a1ce4-1662-414e-9e72-9d014e9c3f5f";

  try {
    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
    });
    isInitialized = true;
    console.log("[OneSignal Client] Web SDK initialized with App ID:", appId);

    // Auto-opt-in if permission was already granted in browser
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        await OneSignal.User.PushSubscription.optIn();
      } catch (optErr) {
        console.warn("[OneSignal Client] OptIn note:", optErr);
      }
    }

    // Listen for subscription changes
    try {
      OneSignal.User.PushSubscription.addEventListener("change", async (event: any) => {
        const subId = event?.current?.id || (await OneSignal.User.PushSubscription.id);
        console.log("[OneSignal Client] Push subscription changed:", subId);
        if (currentSyncedUserId && subId) {
          await syncPushSubscriptionToSupabase(currentSyncedUserId, subId);
        }
      });
    } catch {}
  } catch (err) {
    console.warn("[OneSignal Client] Initialization note:", err);
  }
}

export async function syncPushSubscriptionToSupabase(userId: string, subscriptionId?: string): Promise<void> {
  if (!userId || userId === "00000000-0000-0000-0000-000000000001") return;

  try {
    const subId = subscriptionId || (await OneSignal.User.PushSubscription.id);
    if (!subId) return;

    const supabase = createClient();
    await supabase
      .from("notification_preferences")
      .upsert(
        [
          {
            user_id: userId,
            onesignal_player_id: subId,
            push_enabled: true,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id" }
      );

    console.log(`[OneSignal Client] Synced subscription ${subId} to Supabase user ${userId}`);
  } catch (err) {
    console.warn("[OneSignal Client] Supabase subscription sync note:", err);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined") return "denied";

  try {
    if (!isInitialized) {
      await initOneSignal();
    }
    await OneSignal.Slidedown.promptPush();
    return (Notification?.permission as NotificationPermission) || "default";
  } catch (err) {
    console.error("[OneSignal Client] Error prompting push permission:", err);
    if ("Notification" in window) {
      return await Notification.requestPermission();
    }
    return "denied";
  }
}

export async function getOneSignalUserId(): Promise<string | null | undefined> {
  if (typeof window === "undefined" || !isInitialized) return null;
  try {
    return await OneSignal.User.PushSubscription.id;
  } catch {
    return null;
  }
}

export async function loginOneSignalUser(userId: string): Promise<void> {
  if (typeof window === "undefined" || !userId || userId === "00000000-0000-0000-0000-000000000001") return;
  currentSyncedUserId = userId;

  try {
    if (!isInitialized) {
      await initOneSignal();
    }

    await OneSignal.login(userId);
    console.log(`[OneSignal Client] Linked user external_id: ${userId}`);

    // Read and save subscription ID
    const subId = await OneSignal.User.PushSubscription.id;
    if (subId) {
      await syncPushSubscriptionToSupabase(userId, subId);
    }
  } catch (err) {
    console.warn("[OneSignal Client] Login error note:", err);
  }
}

export async function logoutOneSignalUser(): Promise<void> {
  if (typeof window === "undefined" || !isInitialized) return;
  currentSyncedUserId = null;
  try {
    await OneSignal.logout();
    console.log("[OneSignal Client] Logged out from OneSignal");
  } catch (err) {
    console.warn("[OneSignal Client] Logout error note:", err);
  }
}

export async function scheduleTaskPushNotification(params: {
  userId?: string;
  taskId?: string;
  taskTitle: string;
  startTime?: string | null;
  scheduledIso?: string;
  reminderOffsetMinutes?: number;
  reminderTimes?: string[];
  date?: string;
  category?: string;
  type?: string;
  targetInMinutes?: number;
  customMessage?: string;
  replaceExisting?: boolean;
  timezoneOffsetMinutes?: number;
}): Promise<any> {
  try {
    const tzOffset =
      params.timezoneOffsetMinutes !== undefined
        ? params.timezoneOffsetMinutes
        : typeof window !== "undefined"
        ? new Date().getTimezoneOffset()
        : 0;

    const res = await fetch("/api/notifications/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        timezoneOffsetMinutes: tzOffset,
      }),
    });
    return await res.json();
  } catch (err) {
    console.warn("[OneSignal Client] scheduleTaskPushNotification error:", err);
    return { success: false, error: err };
  }
}

export async function cancelTaskPushNotifications(params: {
  taskId?: string;
  userId?: string;
  reminderType?: string;
}): Promise<any> {
  try {
    const res = await fetch("/api/notifications/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err) {
    console.warn("[OneSignal Client] cancelTaskPushNotifications error:", err);
    return { success: false, error: err };
  }
}

