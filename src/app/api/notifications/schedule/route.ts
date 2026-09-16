import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPushNotification, cancelOneSignalNotification } from "@/lib/onesignal/server";
import { createClient } from "@/utils/supabase/client";

// Helper to cancel any existing scheduled notifications for a given task/item
async function cancelExistingNotifications(taskId: string, userId?: string) {
  const supabase = createClient();
  try {
    let query = supabase
      .from("reminders")
      .select("id, onesignal_notification_id")
      .eq("task_id", taskId)
      .in("status", ["pending", "scheduled"]);

    if (userId && userId !== "00000000-0000-0000-0000-000000000001") {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      for (const row of data) {
        if (row.onesignal_notification_id) {
          await cancelOneSignalNotification(row.onesignal_notification_id);
        }
      }

      await supabase
        .from("reminders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .in(
          "id",
          data.map((r: any) => r.id)
        );
    }
  } catch (e) {
    console.warn("[Notifications] Error cancelling existing notifications:", e);
  }
}

// Store a newly scheduled reminder record in database for future cancellation
async function storeScheduledReminder(params: {
  userId?: string;
  taskId?: string;
  title: string;
  body: string;
  scheduledAt: string;
  onesignalId?: string | null;
  reminderType?: string;
}) {
  const supabase = createClient();
  const userId = params.userId || "00000000-0000-0000-0000-000000000001";
  const nowIso = new Date().toISOString();

  try {
    await supabase.from("reminders").insert([
      {
        user_id: userId,
        task_id: params.taskId || null,
        title: params.title,
        body: params.body,
        scheduled_at: params.scheduledAt,
        status: "scheduled",
        onesignal_notification_id: params.onesignalId || null,
        reminder_type: params.reminderType || "task_reminder",
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);
  } catch (e) {
    console.warn("[Notifications] Failed to store reminder in database:", e);
  }
}

/**
 * Computes exact UTC Date from local date "YYYY-MM-DD" and local time "HH:mm"
 * using the client's timezone offset in minutes (from new Date().getTimezoneOffset()).
 */
function computeUtcDateFromLocal(dateStr: string, timeStr: string, tzOffsetMinutes: number = 0): Date {
  const [year, month, day] = dateStr.split("-").map((v) => parseInt(v, 10) || 0);
  const [hours, minutes] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0) + tzOffsetMinutes * 60 * 1000;
  return new Date(utcMs);
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
      timezoneOffsetMinutes = 0,
    } = body;

    // Block all sleep/bedtime notifications
    if (type === "bedtime" || category === "Sleep" || (typeof taskId === "string" && taskId.startsWith("sleep_"))) {
      if (taskId) {
        await cancelExistingNotifications(taskId, userId);
      }
      return NextResponse.json({ success: true, skipped: true, message: "Sleep notifications are disabled" });
    }

    // 1. If replaceExisting flag is set, cancel previous notifications for this task/routine
    if (replaceExisting && taskId) {
      await cancelExistingNotifications(taskId, userId);
    }

    if (!taskTitle) {
      return NextResponse.json({ error: "taskTitle is required" }, { status: 400 });
    }

    const scheduledDateStr = date || new Date().toISOString().split("T")[0];

    // Check if task is already completed for this date
    if (taskId) {
      const supabase = createClient();
      try {
        let compQuery = supabase
          .from("task_completions")
          .select("completed")
          .eq("task_id", taskId)
          .eq("date", scheduledDateStr);

        if (userId && userId !== "00000000-0000-0000-0000-000000000001") {
          compQuery = compQuery.eq("user_id", userId);
        }

        const { data: compData } = await compQuery.maybeSingle();
        if (compData?.completed) {
          console.log(`[API /api/notifications/schedule] Task ${taskId} is completed on ${scheduledDateStr}. Skipping push.`);
          await cancelExistingNotifications(taskId, userId);
          return NextResponse.json({ success: true, skipped: true, message: "Task already completed" });
        }
      } catch (e) {
        console.warn("[Notifications] Error checking task completion:", e);
      }
    }
    const results: Array<{
      deliveryDate: string;
      deliveryDateUtc: string;
      success: boolean;
      onesignalId: string | null;
      error: string | null;
      targetType?: string;
    }> = [];

    // Helper to send, track and persist single push notification
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

      if (pushRes.success && pushRes.id) {
        await storeScheduledReminder({
          userId,
          taskId,
          title: messageTitle,
          body: messageBody,
          scheduledAt: deliveryDate.toISOString(),
          onesignalId: pushRes.id,
          reminderType: type,
        });
      }

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
        (targetInMinutes > 0 ? `Dans ${targetInMinutes} min` : "C'est l'heure");
      await processDelivery(deliveryDate, title, bodyText);
    }
    // Case B: Timed Task Reminder (e.g. 10 mins before start)
    else if (scheduledIso || startTime) {
      let targetDate: Date;
      if (scheduledIso) {
        targetDate = new Date(scheduledIso);
      } else {
        targetDate = computeUtcDateFromLocal(scheduledDateStr, startTime || "12:00", timezoneOffsetMinutes);
      }

      const offset = typeof reminderOffsetMinutes === "number" ? reminderOffsetMinutes : 10;
      const reminderDate = new Date(targetDate.getTime() - offset * 60000);

      // If scheduled time has already passed today, advance by 24h for recurring habits
      if (reminderDate.getTime() <= Date.now()) {
        reminderDate.setDate(reminderDate.getDate() + 1);
      }

      const title = `${taskTitle}`;
      const bodyText = customMessage || (offset > 0 ? `Dans ${offset} min` : "C'est l'heure");
      await processDelivery(reminderDate, title, bodyText);
    }
    // Case C: All-Day Task Reminders (each specific time)
    else if (Array.isArray(reminderTimes) && reminderTimes.length > 0) {
      for (const rTime of reminderTimes) {
        const reminderDate = computeUtcDateFromLocal(scheduledDateStr, rTime, timezoneOffsetMinutes);

        if (reminderDate.getTime() <= Date.now()) {
          reminderDate.setDate(reminderDate.getDate() + 1);
        }

        const title = `${taskTitle}`;
        const bodyText = customMessage || "C'est l'heure";
        await processDelivery(reminderDate, title, bodyText);
      }
    } else {
      // Case D: Immediate / direct push
      const now = new Date(Date.now() + 1000);
      const title = `${taskTitle}`;
      const bodyText = customMessage || "C'est l'heure";
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

