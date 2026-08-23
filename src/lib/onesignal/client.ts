"use client";

import OneSignal from "react-onesignal";

let isInitialized = false;

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

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        await OneSignal.User.PushSubscription.optIn();
      } catch (optErr) {
        console.warn("OneSignal optIn note:", optErr);
      }
    }
    console.log("OneSignal Web SDK initialized successfully with App ID:", appId);
  } catch (err) {
    console.warn("OneSignal initialization note:", err);
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
    console.error("Error prompting push permission:", err);
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
  try {
    if (!isInitialized) {
      await initOneSignal();
    }
    await OneSignal.login(userId);
    console.log("OneSignal user logged in with external_id:", userId);
  } catch (err) {
    console.warn("OneSignal login error:", err);
  }
}

export async function scheduleTaskPushNotification(params: {
  userId?: string;
  taskTitle: string;
  startTime?: string | null;
  reminderOffsetMinutes?: number;
  reminderTimes?: string[];
  date?: string;
  category?: string;
}): Promise<void> {
  try {
    await fetch("/api/notifications/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn("scheduleTaskPushNotification error:", err);
  }
}
