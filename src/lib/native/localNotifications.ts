import { Capacitor } from "@capacitor/core";
import { LocalNotifications, LocalNotificationSchema } from "@capacitor/local-notifications";

function stringToNumericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647;
}

export const NativeNotifications = {
  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  },

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      if (typeof window !== "undefined" && "Notification" in window) {
        const res = await Notification.requestPermission();
        return res === "granted";
      }
      return false;
    }

    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === "granted") {
        return true;
      }
      const req = await LocalNotifications.requestPermissions();
      return req.display === "granted";
    } catch (err) {
      console.warn("[NativeNotifications] requestPermission error:", err);
      return false;
    }
  },

  async scheduleNotification(options: {
    id?: string | number;
    title: string;
    body: string;
    scheduleAt?: Date;
    extra?: Record<string, any>;
    sound?: string;
  }): Promise<number | null> {
    if (!this.isSupported()) return null;

    try {
      const perm = await this.requestPermission();
      if (!perm) return null;

      const notifId =
        typeof options.id === "number"
          ? options.id
          : options.id
          ? stringToNumericId(options.id)
          : Math.floor(Math.random() * 2000000000);

      // If a schedule time is specified and has already passed, block it to avoid instant fire of old tasks
      if (options.scheduleAt && options.scheduleAt.getTime() <= Date.now() + 5000) {
        console.log(`[NativeNotifications] Skipping notification #${notifId} "${options.title}" because scheduled time is in the past:`, options.scheduleAt);
        return null;
      }

      const notifSchema: LocalNotificationSchema = {
        id: notifId,
        title: options.title,
        body: options.body,
        extra: options.extra || {},
        schedule: options.scheduleAt
          ? { at: options.scheduleAt, allowWhileIdle: true }
          : undefined,
      };

      await LocalNotifications.schedule({
        notifications: [notifSchema],
      });

      console.log(`[NativeNotifications] Scheduled notification #${notifId} "${options.title}" at:`, options.scheduleAt || "immediate");
      return notifId;
    } catch (err) {
      console.warn("[NativeNotifications] scheduleNotification error:", err);
      return null;
    }
  },

  async cancelNotification(id: string | number): Promise<void> {
    if (!this.isSupported()) return;

    try {
      const notifId = typeof id === "number" ? id : stringToNumericId(id);
      await LocalNotifications.cancel({
        notifications: [{ id: notifId }],
      });
      console.log(`[NativeNotifications] Cancelled notification #${notifId}`);
    } catch (err) {
      console.warn("[NativeNotifications] cancelNotification error:", err);
    }
  },

  async cancelAll(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
      await this.clearAllDeliveredNotifications();
    } catch (err) {
      console.warn("[NativeNotifications] cancelAll error:", err);
    }
  },

  async removeDeliveredNotification(id: string | number): Promise<void> {
    if (!this.isSupported()) return;

    try {
      const notifId = typeof id === "number" ? id : stringToNumericId(id);
      await (LocalNotifications as any).removeDeliveredNotifications({
        notifications: [{ id: notifId }],
      });
      console.log(`[NativeNotifications] Removed delivered notification #${notifId}`);
    } catch (err) {
      console.warn("[NativeNotifications] removeDeliveredNotification error:", err);
    }
  },

  async clearAllDeliveredNotifications(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      await LocalNotifications.removeAllDeliveredNotifications();
      console.log("[NativeNotifications] Cleared all delivered notifications from lock screen");
    } catch (err) {
      console.warn("[NativeNotifications] clearAllDeliveredNotifications error:", err);
    }
  },

  setupListeners(onAction?: (data: any) => void): () => void {
    if (!this.isSupported()) return () => {};

    let removeListener: any = null;

    LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      console.log("[NativeNotifications] Action performed:", action);
      const extra = action.notification?.extra;
      if (onAction) {
        onAction(extra);
      }
      if (extra?.taskId) {
        window.dispatchEvent(
          new CustomEvent("mytrack:open-url", {
            detail: { url: `mytrack://tasks?taskId=${extra.taskId}` },
          })
        );
      }
    }).then((handle) => {
      removeListener = handle;
    }).catch(() => {});

    return () => {
      if (removeListener && typeof removeListener.remove === "function") {
        removeListener.remove();
      }
    };
  },
};
