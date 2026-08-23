"use client";

import { initOneSignal } from "@/lib/onesignal/client";
import { sendNativeNotification } from "@/lib/notifications/service";

export interface NotificationStatusResult {
  status: "granted" | "denied" | "default" | "unsupported" | "ios_standalone_needed";
  message: string;
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore
    Boolean(window.navigator.standalone)
  );
}

/**
 * Universal cross-device push notification enabler
 * Supports iOS 16.4+ (PWA / Safari), Android Chrome, macOS Safari/Chrome, Windows, Linux
 */
export async function enableCrossDeviceNotifications(): Promise<NotificationStatusResult> {
  if (typeof window === "undefined") {
    return { status: "unsupported", message: "Environnement serveur non supporté." };
  }

  const isIos = isIosDevice();
  const isPwa = isStandalonePwa();

  // On iOS, Web Push is supported in standalone mode (iOS 16.4+)
  if (isIos && !isPwa && !("Notification" in window)) {
    return {
      status: "ios_standalone_needed",
      message: "Sur iPhone, ajoute MyTrack à l'écran d'accueil (Partager > 'Sur l'écran d'accueil') pour activer les notifications.",
    };
  }

  // Check browser Notification support
  if (!("Notification" in window)) {
    return {
      status: "unsupported",
      message: "Ce navigateur ne supporte pas les notifications push.",
    };
  }

  try {
    // 1. Ensure Service Worker is registered
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (swErr) {
        console.warn("ServiceWorker registration note:", swErr);
      }
    }

    // 2. Initialize OneSignal
    try {
      await initOneSignal();
    } catch (osErr) {
      console.warn("OneSignal initialization note:", osErr);
    }

    // 3. Request native browser notification permission
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      // 4. Send welcome / verification notification to confirm working status on device
      await sendNativeNotification({
        title: "🔔 Notifications activées !",
        body: "MyTrack t'enverra désormais tes rappels et bilans sur cet appareil.",
        tag: "welcome-push",
      });

      return {
        status: "granted",
        message: "Notifications activées avec succès sur cet appareil !",
      };
    } else if (permission === "denied") {
      return {
        status: "denied",
        message: "Notifications bloquées dans les paramètres de ton navigateur. Active-les dans les réglages de ton appareil.",
      };
    } else {
      return {
        status: "default",
        message: "Demande de notification reportée.",
      };
    }
  } catch (err: any) {
    console.error("Erreur lors de l'activation des notifications:", err);
    return {
      status: "denied",
      message: err?.message || "Impossible d'activer les notifications sur cet appareil.",
    };
  }
}
