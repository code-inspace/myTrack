import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPushNotification } from "@/lib/onesignal/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      taskTitle,
      taskId,
      startTime,
      reminderOffsetMinutes = 10,
      reminderTimes = [],
      date,
      category,
      type = "task_reminder",
      customMessage,
      targetInMinutes,
    } = body;

    if (!taskTitle) {
      return NextResponse.json({ error: "taskTitle is required" }, { status: 400 });
    }

    const scheduledDateStr = date || new Date().toISOString().split("T")[0];
    const results: Array<{
      deliveryDate: string;
      deliveryDateUtc: string;
      success: boolean;
      onesignalId: string | null;
      error: string | null;
      targetType?: string;
    }> = [];

    // Helper to send and track single notification
    const processDelivery = async (deliveryDate: Date, messageTitle: string, messageBody: string) => {
      console.log(`[API /api/notifications/schedule] Scheduling push for ${deliveryDate.toISOString()} to user=${userId || "all"}`);

      const pushRes = await sendOneSignalPushNotification({
        userId,
        title: messageTitle,
        body: messageBody,
        sendAfterDate: deliveryDate,
        data: {
          taskId,
          taskTitle,
          scheduledDate: scheduledDateStr,
          type,
        },
      });

      results.push({
        deliveryDate: deliveryDate.toISOString(),
        deliveryDateUtc: deliveryDate.toUTCString(),
        success: pushRes.success,
        onesignalId: pushRes.id || null,
        error: pushRes.error || null,
        targetType: pushRes.targetType,
      });
    };

    // Case A: Custom relative offset in minutes (e.g. test in 2 minutes)
    if (typeof targetInMinutes === "number") {
      const deliveryDate = new Date(Date.now() + targetInMinutes * 60 * 1000);
      const title = `🔔 ${taskTitle}`;
      const bodyText = customMessage || `Rappel programmé à ${deliveryDate.toLocaleTimeString("fr-FR")} 🎯`;
      await processDelivery(deliveryDate, title, bodyText);
    }
    // Case B: Timed Task Reminder (e.g. 10 mins before start)
    else if (startTime) {
      const [hours, minutes] = startTime.split(":").map((v: string) => parseInt(v, 10) || 0);
      const targetDate = new Date(`${scheduledDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);

      // Subtract offset minutes
      const reminderDate = new Date(targetDate.getTime() - (reminderOffsetMinutes || 10) * 60000);

      // If scheduled time has already passed today, advance by 24h for recurring habits
      if (reminderDate.getTime() <= Date.now()) {
        reminderDate.setDate(reminderDate.getDate() + 1);
      }

      const title = `Rappel • ${taskTitle}`;
      const bodyText = `C'est l'heure de ton habitude prévue à ${startTime} 🎯`;
      await processDelivery(reminderDate, title, bodyText);
    }
    // Case C: All-Day Task Reminders (each specific time)
    else if (Array.isArray(reminderTimes) && reminderTimes.length > 0) {
      for (const rTime of reminderTimes) {
        const [hours, minutes] = rTime.split(":").map((v: string) => parseInt(v, 10) || 0);
        const reminderDate = new Date(`${scheduledDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);

        if (reminderDate.getTime() <= Date.now()) {
          reminderDate.setDate(reminderDate.getDate() + 1);
        }

        const title = `Rappel • ${taskTitle}`;
        const bodyText = `N'oublie pas ton objectif du jour : ${taskTitle} 💪`;
        await processDelivery(reminderDate, title, bodyText);
      }
    } else {
      // Case D: Immediate / direct push
      const now = new Date(Date.now() + 1000);
      const title = `🔔 ${taskTitle}`;
      const bodyText = customMessage || `Rappel MyTrack`;
      await processDelivery(now, title, bodyText);
    }

    return NextResponse.json({
      success: results.some((r) => r.success),
      results,
    });
  } catch (err: any) {
    console.error("[API /api/notifications/schedule] Server error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
