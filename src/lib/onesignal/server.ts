/**
/**
 * OneSignal Server REST API Client
 * Used to schedule and send push notifications even when the app/PWA is closed.
 */

export interface ScheduleNotificationParams {
  userId?: string;
  externalId?: string;
  subscriptionId?: string;
  title: string;
  body: string;
  sendAfterDate?: Date | string; // ISO or Date object for send_after
  data?: Record<string, any>;
  url?: string;
}

export async function sendOneSignalPushNotification(
  params: ScheduleNotificationParams
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey =
    process.env.ONESIGNAL_REST_API_KEY ||
    process.env.ONESIGNAL_API_KEY;

  const appId =
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
    "945a1ce4-1662-414e-9e72-9d014e9c3f5f";

  if (!apiKey) {
    console.warn(
      "⚠️ ONESIGNAL_REST_API_KEY is not defined in environment variables. Scheduled push notification was skipped."
    );
    return {
      success: false,
      error: "ONESIGNAL_REST_API_KEY non configurée",
    };
  }

  const payload: Record<string, any> = {
    app_id: appId,
    target_channel: "push",
    headings: { fr: params.title, en: params.title },
    contents: { fr: params.body, en: params.body },
    url: params.url || "https://mytrack-nine.vercel.app/tasks",
    data: params.data || {},
  };

  // Targeting: external_id (Supabase User ID), specific subscription, or all active subscribed users
  const targetUser = params.userId || params.externalId;
  if (targetUser && targetUser !== "00000000-0000-0000-0000-000000000001") {
    payload.include_aliases = {
      external_id: [targetUser],
    };
  } else if (params.subscriptionId) {
    payload.include_subscription_ids = [params.subscriptionId];
  } else {
    // Broadcast to subscribed users
    payload.included_segments = ["Subscribed Users"];
  }

  // Schedule time (send_after in UTC format e.g. "2026-08-23 21:00:00 GMT+0000")
  if (params.sendAfterDate) {
    const d = typeof params.sendAfterDate === "string" ? new Date(params.sendAfterDate) : params.sendAfterDate;
    if (!isNaN(d.getTime())) {
      // Must be at least in the future
      if (d.getTime() > Date.now()) {
        payload.send_after = d.toUTCString();
      }
    }
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data.errors) {
      console.warn("OneSignal REST API response error:", data);
      return { success: false, error: JSON.stringify(data.errors || data) };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("OneSignal REST API request failed:", err);
    return { success: false, error: err.message };
  }
}

export async function cancelOneSignalNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey =
    process.env.ONESIGNAL_REST_API_KEY ||
    process.env.ONESIGNAL_API_KEY;

  const appId =
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
    "945a1ce4-1662-414e-9e72-9d014e9c3f5f";

  if (!apiKey || !notificationId) return { success: false };

  try {
    const res = await fetch(
      `https://onesignal.com/api/v1/notifications/${notificationId}?app_id=${appId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      }
    );
    const data = await res.json();
    return { success: res.ok };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
