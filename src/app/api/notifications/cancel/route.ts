import { NextRequest, NextResponse } from "next/server";
import { cancelOneSignalNotification } from "@/lib/onesignal/server";
import { createClient } from "@/utils/supabase/client";

export async function POST(req: NextRequest) {
  try {
    const { taskId, userId, reminderType } = await req.json();

    if (!taskId && !userId) {
      return NextResponse.json({ error: "taskId or userId is required" }, { status: 400 });
    }

    const supabase = createClient();
    let query = supabase
      .from("reminders")
      .select("id, onesignal_notification_id")
      .in("status", ["pending", "scheduled"]);

    if (taskId) {
      query = query.eq("task_id", taskId);
    }
    if (userId && userId !== "00000000-0000-0000-0000-000000000001") {
      query = query.eq("user_id", userId);
    }
    if (reminderType) {
      query = query.eq("reminder_type", reminderType);
    }

    const { data, error } = await query;

    let cancelledCount = 0;
    if (!error && data && data.length > 0) {
      for (const row of data) {
        if (row.onesignal_notification_id) {
          const res = await cancelOneSignalNotification(row.onesignal_notification_id);
          if (res.success) cancelledCount++;
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

    return NextResponse.json({
      success: true,
      cancelledCount,
      totalMatched: data?.length || 0,
    });
  } catch (err: any) {
    console.error("[API /api/notifications/cancel] Server error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
