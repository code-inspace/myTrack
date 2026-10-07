import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPushNotification, cancelOneSignalNotification } from "@/lib/onesignal/server";
import { getAdminClient, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { getProjectColumns } from "@/features/projects/types";

// Helper to cancel any existing scheduled notifications for a given task/item
async function cancelExistingNotifications(taskId: string, userId: string) {
  const supabase = getAdminClient();
  try {
    const { data, error } = await supabase
      .from("reminders")
      .select("id, onesignal_notification_id")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .in("status", ["pending", "scheduled"]);
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
  userId: string;
  taskId?: string;
  title: string;
  body: string;
  scheduledAt: string;
  onesignalId?: string | null;
  reminderType?: string;
}) {
  const supabase = getAdminClient();
  const userId = params.userId;
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
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    const {
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

    // "Today" in the user's timezone (getTimezoneOffset sign: UTC - local, in minutes), not the server's.
    const todayDateStr = new Date(Date.now() - (Number(timezoneOffsetMinutes) || 0) * 60000)
      .toISOString()
      .split("T")[0];
    const scheduledDateStr = date || todayDateStr;

    // Block notifications for past dates entirely
    if (scheduledDateStr < todayDateStr) {
      if (taskId) {
        await cancelExistingNotifications(taskId, userId);
      }
      return NextResponse.json({ success: true, skipped: true, message: "Date is in the past" });
    }

    let isTaskRecurring = false;

    // Check if task is archived, DONE, disabled, or already completed
    if (taskId) {
      const supabase = getAdminClient();
      try {
        const { data: taskData } = await supabase
          .from("tasks")
          .select("is_archived, project_id, project_status, recurrence, date_overrides")
          .eq("id", taskId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!taskData) {
          return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        let doneColumnId = "DONE";
        if (taskData.project_id) {
          const { data: project } = await supabase
            .from("projects")
            .select("columns")
            .eq("id", taskData.project_id)
            .maybeSingle();
          const columns = getProjectColumns({ columns: Array.isArray(project?.columns) ? project.columns : [] });
          doneColumnId = columns.find((c) => c.isDone)?.id || doneColumnId;
        }
        const isRecurringTask = Boolean(taskData.recurrence && taskData.recurrence !== "ONCE");

        if (taskData) {
          // A recurring habit's board column doesn't mean every future occurrence is done.
          if (taskData.is_archived || (!isRecurringTask && taskData.project_status === doneColumnId)) {
            console.log(`[API /api/notifications/schedule] Task ${taskId} is archived or DONE. Skipping push.`);
            await cancelExistingNotifications(taskId, userId);
            return NextResponse.json({ success: true, skipped: true, message: "Task is archived or completed" });
          }
          if (taskData.date_overrides?._enableReminders === false) {
            await cancelExistingNotifications(taskId, userId);
            return NextResponse.json({ success: true, skipped: true, message: "Reminders disabled for task" });
          }
          if (taskData.recurrence && taskData.recurrence !== "ONCE") {
            isTaskRecurring = true;
          }
        }

        const { data: compData } = await supabase
          .from("task_completions")
          .select("completed")
          .eq("task_id", taskId)
          .eq("user_id", userId)
          .eq("date", scheduledDateStr)
          .maybeSingle();
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
      // NEVER send or schedule a notification whose delivery date is in the past (prevents instant spamming of old notifications)
      if (deliveryDate.getTime() <= Date.now() + 5000) {
        console.log(`[API /api/notifications/schedule] Delivery date ${deliveryDate.toISOString()} is in the past. Skipping push.`);
        return;
      }

      console.log(`[API /api/notifications/schedule] Scheduling push for ${deliveryDate.toISOString()} to user=${userId}`);

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

      // If scheduled time has already passed today
      if (reminderDate.getTime() <= Date.now() + 60000) {
        if (isTaskRecurring) {
          // For recurring habits, advance by 24h
          reminderDate.setDate(reminderDate.getDate() + 1);
        } else {
          // For single tasks in the past, DO NOT schedule or fire
          return NextResponse.json({ success: true, skipped: true, message: "Task time is in the past" });
        }
      }

      const title = `${taskTitle}`;
      const bodyText = customMessage || (offset > 0 ? `Dans ${offset} min` : "C'est l'heure");
      await processDelivery(reminderDate, title, bodyText);
    }
    // Case C: All-Day Task Reminders (each specific time)
    else if (Array.isArray(reminderTimes) && reminderTimes.length > 0) {
      for (const rTime of reminderTimes) {
        const reminderDate = computeUtcDateFromLocal(scheduledDateStr, rTime, timezoneOffsetMinutes);

        if (reminderDate.getTime() <= Date.now() + 60000) {
          if (isTaskRecurring) {
            reminderDate.setDate(reminderDate.getDate() + 1);
          } else {
            continue;
          }
        }

        const title = `${taskTitle}`;
        const bodyText = customMessage || "C'est l'heure";
        await processDelivery(reminderDate, title, bodyText);
      }
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

