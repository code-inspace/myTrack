import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPushNotification } from "@/lib/onesignal/server";
import { createClient } from "@/utils/supabase/client";

// Cancel any existing scheduled notifications for a given task
async function cancelExistingNotifications(taskId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_notifications")
    .select("onesignal_id")
    .eq("task_id", taskId);
  if (error) {
    console.warn("Failed to fetch existing notifications for cancellation", error);
    return;
  }
  if (data && data.length) {
    for (const row of data) {
      try {
        await fetch(`https://onesignal.com/api/v1/notifications/${row.onesignal_id}`, {
          method: "DELETE",
          headers: { Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}` },
        });
      } catch (e) {
        console.warn("Error cancelling OneSignal notification", e);
      }
    }
    await supabase.from("task_notifications").delete().eq("task_id", taskId);
  }
}

// Store a newly scheduled notification for later cancellation
async function storeScheduledNotification(taskId: string, userId: string | undefined, onesignalId: string, scheduleDate: string) {
  const supabase = createClient();
  try {
    await supabase.from("task_notifications").insert({
      task_id: taskId,
      user_id: userId,
      onesignal_id: onesignalId,
      scheduled_at: scheduleDate,
    });
  } catch (e) {
    console.warn("Failed to store scheduled notification", e);
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      taskTitle,
      taskId,
      startTime,
      scheduledIso,
      reminderOffsetMinutes = 10,
      reminderTimes = [],
      date,
      category,
      type = "task_reminder",
      customMessage,
      targetInMinutes,
      replaceExisting,
    } = body;

    // If replaceExisting flag is set, cancel any existing notifications for this task before scheduling new ones
    if (replaceExisting && taskId) {
      await cancelExistingNotifications(taskId);
    }
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
      const title = `${taskTitle}`;
      const bodyText =
        customMessage ||
        (targetInMinutes > 0
          ? `Dans ${targetInMinutes} minute${targetInMinutes > 1 ? "s" : ""}`
          : `C'est l'heure ! 🎯`);
      await processDelivery(deliveryDate, title, bodyText);
    }
    // Case B: Timed Task Reminder (e.g. 10 mins before start)
    else if (scheduledIso || startTime) {
      let targetDate: Date;
      if (scheduledIso) {
        targetDate = new Date(scheduledIso);
      } else {
        const [hours, minutes] = (startTime || "12:00").split(":").map((v: string) => parseInt(v, 10) || 0);
        targetDate = new Date(`${scheduledDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
      }

      const offset = typeof reminderOffsetMinutes === "number" ? reminderOffsetMinutes : 10;

      // Subtract offset minutes
      const reminderDate = new Date(targetDate.getTime() - offset * 60000);

      // If scheduled time has already passed today, advance by 24h for recurring habits
      if (reminderDate.getTime() <= Date.now()) {
        reminderDate.setDate(reminderDate.getDate() + 1);
      }

      const title = `${taskTitle}`;
      const bodyText = offset > 0 ? `Dans ${offset} minute${offset > 1 ? "s" : ""}` : `C'est l'heure ! 🎯`;
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

        const title = `${taskTitle}`;
        const bodyText = `Objectif du jour à ${rTime}`;
        await processDelivery(reminderDate, title, bodyText);
      }
    } else {
      // Case D: Immediate / direct push
      const now = new Date(Date.now() + 1000);
      const title = `${taskTitle}`;
      const bodyText = customMessage || `C'est l'heure ! 🎯`;
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
