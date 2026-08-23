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
    });
    isInitialized = true;
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

export async function setOneSignalUserTag(key: string, value: string): Promise<void> {
  if (typeof window === "undefined" || !isInitialized) return;
  try {
    OneSignal.User.addTag(key, value);
  } catch (err) {
    console.warn("OneSignal tag error:", err);
  }
}
