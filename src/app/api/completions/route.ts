import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

// GET /api/completions
export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("task_completions")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const completions = (data || []).map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      date: row.date,
      completed: Boolean(row.completed),
      value: row.value !== null ? parseFloat(row.value) : null,
      duration: row.duration || null,
      notes: row.notes || null,
      scheduledStartTime: row.scheduled_start_time || null,
      scheduledEndTime: row.scheduled_end_time || null,
      actualStartTime: row.actual_start_time || null,
      actualEndTime: row.actual_end_time || null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));

    return NextResponse.json({ completions });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/completions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { completion } = body;
    const targetUserId = await getRequestUserId(req);
    if (!targetUserId) return unauthorizedResponse();

    if (!completion?.taskId || !completion?.date) {
      return NextResponse.json({ error: "Missing required completion fields" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: ownedTask } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", completion.taskId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!ownedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Partial upsert: fields the client didn't send keep their stored value instead of being nulled.
    const record: Record<string, any> = {
      task_id: completion.taskId,
      user_id: targetUserId,
      date: completion.date,
      completed: Boolean(completion.completed),
      updated_at: new Date().toISOString(),
    };
    const optionalFields: Array<[string, string]> = [
      ["value", "value"],
      ["duration", "duration"],
      ["notes", "notes"],
      ["scheduledStartTime", "scheduled_start_time"],
      ["scheduledEndTime", "scheduled_end_time"],
      ["actualStartTime", "actual_start_time"],
      ["actualEndTime", "actual_end_time"],
    ];
    for (const [key, column] of optionalFields) {
      if (completion[key] !== undefined) record[column] = completion[key];
    }

    const { error } = await supabase
      .from("task_completions")
      .upsert([record], { onConflict: "task_id,date" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, completion });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
