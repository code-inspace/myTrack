import { NextRequest, NextResponse } from "next/server";
import { cancelOneSignalNotification } from "@/lib/onesignal/server";
import { getAdminClient, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const { taskId, reminderType } = await req.json();
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    const supabase = getAdminClient();
    let query = supabase
      .from("reminders")
      .select("id, onesignal_notification_id")
      .eq("user_id", userId)
      .in("status", ["pending", "scheduled"]);

    if (taskId) {
      query = query.eq("task_id", taskId);
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
        )
        .eq("user_id", userId);
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
