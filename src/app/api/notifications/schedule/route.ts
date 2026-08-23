import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPushNotification } from "@/lib/onesignal/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      taskTitle,
      startTime,
      reminderOffsetMinutes = 10,
      reminderTimes = [],
      date,
      category,
    } = body;

    if (!taskTitle) {
      return NextResponse.json({ error: "taskTitle is required" }, { status: 400 });
    }

    const scheduledDateStr = date || new Date().toISOString().split("T")[0];
    const results = [];

    if (startTime) {
      // 1. Timed Task Reminder (e.g. 10 mins before start)
      const [hours, minutes] = startTime.split(":").map((v: string) => parseInt(v, 10) || 0);
      const targetDate = new Date(`${scheduledDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);

      // Subtract offset minutes
      const reminderDate = new Date(targetDate.getTime() - (reminderOffsetMinutes || 10) * 60000);

      // If scheduled time has already passed today, advance by 24h for recurring habits
      if (reminderDate.getTime() <= Date.now()) {
        reminderDate.setDate(reminderDate.getDate() + 1);
      }

      const res = await sendOneSignalPushNotification({
        userId,
        title: `Rappel • ${taskTitle}`,
        body: `C'est l'heure de ton habitude prévue à ${startTime} 🎯`,
        sendAfterDate: reminderDate,
        data: { taskTitle, scheduledDate: scheduledDateStr },
      });
      results.push(res);
    } else if (Array.isArray(reminderTimes) && reminderTimes.length > 0) {
      // 2. All-Day Task Reminders (each specific time)
      for (const rTime of reminderTimes) {
        const [hours, minutes] = rTime.split(":").map((v: string) => parseInt(v, 10) || 0);
        const reminderDate = new Date(`${scheduledDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);

        if (reminderDate.getTime() <= Date.now()) {
          reminderDate.setDate(reminderDate.getDate() + 1);
        }

        const res = await sendOneSignalPushNotification({
          userId,
          title: `Rappel • ${taskTitle}`,
          body: `N'oublie pas ton objectif du jour : ${taskTitle} 💪`,
          sendAfterDate: reminderDate,
          data: { taskTitle, scheduledDate: scheduledDateStr },
        });
        results.push(res);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("API /api/notifications/schedule error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
