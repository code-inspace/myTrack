import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { resolveWidgetContext, getProjectDoneColumnId, WidgetContext } from "@/lib/supabase/widgetContext";

/**
 * Mirrors the app's finishTaskExecution: the occurrence date is the user's local date of the
 * start, durations are accumulated in minutes, and the earliest start of the day is kept.
 */
interface TaskRow {
  id: string;
  started_at: string | null;
  start_time: string | null;
  recurrence: string | null;
  date_overrides: Record<string, Record<string, unknown>> | null;
  project_id: string | null;
}

async function finishTask(ctx: WidgetContext, task: TaskRow, now: Date) {
  const { supabase, userId } = ctx;
  const nowIso = now.toISOString();
  const nowUtcTime = ctx.utcTime(now);

  let startInstant: Date | null = null;
  if (task.started_at) {
    const parsed = new Date(task.started_at);
    if (!isNaN(parsed.getTime())) startInstant = parsed;
  }
  const date = ctx.localDate(startInstant || now);
  const sessionStartUtc = startInstant ? ctx.utcTime(startInstant) : task.start_time || nowUtcTime;
  const sessionMinutes = startInstant
    ? Math.max(1, Math.round((now.getTime() - startInstant.getTime()) / 60000))
    : 1;

  await supabase
    .from("tasks")
    .update({ is_active: false, started_at: null, updated_at: nowIso })
    .eq("id", task.id)
    .eq("user_id", userId);

  const { data: existingComp } = await supabase
    .from("task_completions")
    .select("*")
    .eq("task_id", task.id)
    .eq("date", date)
    .maybeSingle();

  const prevDuration =
    existingComp?.completed && typeof existingComp?.duration === "number" ? existingComp.duration : 0;
  const earliestStart = existingComp?.actual_start_time || sessionStartUtc;

  await supabase.from("task_completions").upsert(
    [
      {
        task_id: task.id,
        user_id: userId,
        date,
        completed: true,
        duration: prevDuration + sessionMinutes,
        actual_start_time: earliestStart,
        actual_end_time: nowUtcTime,
        scheduled_start_time: earliestStart,
        scheduled_end_time: nowUtcTime,
        updated_at: nowIso,
      },
    ],
    { onConflict: "task_id,date" },
  );

  // Position the occurrence on the agenda like the app does (ONCE: task times, recurring: date override).
  const isRecurring = task.recurrence && task.recurrence !== "ONCE";
  if (isRecurring) {
    const overrides = task.date_overrides || {};
    await supabase
      .from("tasks")
      .update({
        date_overrides: {
          ...overrides,
          [date]: { ...(overrides[date] || {}), startTime: earliestStart, endTime: nowUtcTime },
        },
      })
      .eq("id", task.id)
      .eq("user_id", userId);
  } else {
    await supabase
      .from("tasks")
      .update({ start_time: earliestStart, end_time: nowUtcTime })
      .eq("id", task.id)
      .eq("user_id", userId);
  }

  const doneColumnId = task.project_id ? await getProjectDoneColumnId(supabase, task.project_id) : "DONE";
  await supabase
    .from("tasks")
    .update({ project_status: doneColumnId, updated_at: nowIso })
    .eq("id", task.id)
    .eq("user_id", userId);
}

// POST /api/widget/stop-task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const taskId: string | undefined = body?.taskId;

    const ctx = await resolveWidgetContext(req, body);
    if (!ctx) return unauthorizedResponse();
    const { supabase, userId } = ctx;
    const now = new Date();

    let query = supabase.from("tasks").select("*").eq("user_id", userId);
    // Without a specific task, close every active task of THIS user only.
    query = taskId ? query.eq("id", taskId) : query.eq("is_active", true);
    const { data: tasks } = await query;

    for (const task of tasks || []) {
      await finishTask(ctx, task, now);
    }

    return NextResponse.json(
      { success: true, stopped: (tasks || []).length },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error)?.message }, { status: 500 });
  }
}
