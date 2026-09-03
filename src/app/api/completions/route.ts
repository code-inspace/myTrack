import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

function getAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// GET /api/completions?userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

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
    const { completion, userId } = body;
    const targetUserId = userId || completion?.userId;

    if (!targetUserId || !completion?.taskId || !completion?.date) {
      return NextResponse.json({ error: "Missing required completion fields" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const record = {
      task_id: completion.taskId,
      user_id: targetUserId,
      date: completion.date,
      completed: Boolean(completion.completed),
      value: completion.value !== undefined ? completion.value : null,
      duration: completion.duration !== undefined ? completion.duration : null,
      notes: completion.notes || null,
      scheduled_start_time: completion.scheduledStartTime || null,
      scheduled_end_time: completion.scheduledEndTime || null,
      actual_start_time: completion.actualStartTime || null,
      actual_end_time: completion.actualEndTime || null,
      updated_at: new Date().toISOString(),
    };

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
