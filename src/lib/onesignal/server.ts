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
): Promise<{ success: boolean; id?: string; error?: string; targetType?: string }> {
  const apiKey =
    process.env.ONESIGNAL_REST_API_KEY ||
    process.env.ONESIGNAL_API_KEY;

  const appId =
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
    "945a1ce4-1662-414e-9e72-9d014e9c3f5f";

  if (!apiKey) {
    console.warn(
      "⚠️ [OneSignal] ONESIGNAL_REST_API_KEY is not defined in environment variables. Scheduled push notification was skipped."
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

  let targetType = "broadcast";

  // Targeting: external_id (Supabase User ID), specific subscription, or broadcast fallback
  const targetUser = params.userId || params.externalId;
  if (targetUser && targetUser !== "00000000-0000-0000-0000-000000000001") {
    payload.include_aliases = {
      external_id: [targetUser],
    };
    targetType = `external_id (${targetUser})`;
  } else if (params.subscriptionId) {
    payload.include_subscription_ids = [params.subscriptionId];
    targetType = `subscription (${params.subscriptionId})`;
  } else {
    // Broadcast to subscribed users
    payload.included_segments = ["Total Subscriptions", "Subscribed Users"];
    targetType = "segments (Total Subscriptions)";
  }

  // Schedule time (send_after in UTC format e.g. "Sun, 23 Aug 2026 21:00:00 GMT")
  let scheduledUtcStr: string | null = null;
  if (params.sendAfterDate) {
    const d = typeof params.sendAfterDate === "string" ? new Date(params.sendAfterDate) : params.sendAfterDate;
    if (!isNaN(d.getTime())) {
      // If delivery is in the future, set send_after
      if (d.getTime() > Date.now()) {
        scheduledUtcStr = d.toUTCString();
        payload.send_after = scheduledUtcStr;
      }
    }
  }

  console.log(`[OneSignal] Dispatching push: title="${params.title}", target=${targetType}, send_after=${scheduledUtcStr || "immediate"}`);

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
    if (!res.ok || (data.errors && data.errors.length > 0)) {
      console.warn("[OneSignal] REST API response error:", data);
      return {
        success: false,
        error: JSON.stringify(data.errors || data),
        targetType,
      };
    }

    console.log(`[OneSignal] Notification successfully created. ID: ${data.id}, recipients: ${data.recipients ?? 1}`);
    return {
      success: true,
      id: data.id,
      targetType,
    };
  } catch (err: any) {
    console.error("[OneSignal] REST API request failed:", err);
    return {
      success: false,
      error: err?.message || "OneSignal request failed",
      targetType,
    };
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
