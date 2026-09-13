import { requestNotificationPermission } from "@/lib/onesignal/client";
import { NativeNotifications } from "@/lib/native/localNotifications";

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Sends a native local notification (iOS Capacitor) or Web Push Notification,
 * falling back gracefully if permissions or service workers are restricted.
 */
export async function sendNativeNotification(options: PushNotificationOptions): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    // 0. Native iOS Local Notification (Capacitor)
    if (NativeNotifications.isSupported()) {
      const id = await NativeNotifications.scheduleNotification({
        title: options.title,
        body: options.body,
        extra: options.data,
      });
      return id !== null;
    }
    // 1. Check & Request permission if not already granted
    let perm: NotificationPermission = "default";
    if ("Notification" in window) {
      perm = Notification.permission;
      if (perm !== "granted") {
        perm = await requestNotificationPermission();
      }
    }

    if (perm !== "granted") {
      console.warn("Notification permission not granted:", perm);
      return false;
    }

    // 2. Try Service Worker showNotification (Best for PWA & iOS Safari 16.4+)
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: options.tag || "mytrack-reminder",
          data: options.data,
          // @ts-ignore - actions for interactive notifications
          actions: options.actions || [
            { action: "YES", title: "✓ Fait" },
            { action: "NO", title: "✗ Plus tard" },
          ],
        });
        return true;
      }
    }

    // 3. Direct window Notification fallback
    if ("Notification" in window) {
      new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/icons/icon-192.png",
        tag: options.tag || "mytrack-reminder",
        data: options.data,
      });
      return true;
    }
  } catch (err) {
    console.error("Failed to display native notification:", err);
  }

  return false;
}
