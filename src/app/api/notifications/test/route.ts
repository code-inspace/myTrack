import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPushNotification } from "@/lib/onesignal/server";
import { getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    const body = await req.json().catch(() => ({}));
    const {
      delayMinutes = 2,
      customTitle = "🔔 Test MyTrack — Notification Push",
      customBody,
    } = body;

    const targetDate = new Date(Date.now() + delayMinutes * 60 * 1000);
    const bodyText = customBody || `🎉 Notification de test programmée pour ${targetDate.toLocaleTimeString("fr-FR")} reçue avec succès !`;

    console.log(`[Test Route] Scheduling test notification for ${targetDate.toUTCString()} (Local: ${targetDate.toLocaleTimeString("fr-FR")}) to user=${userId}`);

    const pushRes = await sendOneSignalPushNotification({
      userId,
      title: customTitle,
      body: bodyText,
      sendAfterDate: targetDate,
      data: {
        type: "test_notification",
        scheduledFor: targetDate.toISOString(),
      },
    });

    return NextResponse.json({
      success: pushRes.success,
      notificationId: pushRes.id || null,
      error: pushRes.error || null,
      targetType: pushRes.targetType,
      scheduledTimeLocal: targetDate.toLocaleTimeString("fr-FR"),
      scheduledTimeUtc: targetDate.toUTCString(),
      delayMinutes,
    });
  } catch (err: any) {
    console.error("[Test Route] Error:", err);
    return NextResponse.json({ error: err?.message || "Test route error" }, { status: 500 });
  }
}
