import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { resolveWidgetContext } from "@/lib/supabase/widgetContext";
import { decryptText, isEncrypted } from "@/lib/crypto/encryption";


// POST /api/widget/start-task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const taskId = body?.taskId;

    const ctx = await resolveWidgetContext(req, body);
    if (!ctx) return unauthorizedResponse();
    const { supabase, userId } = ctx;

    if (!taskId) {
      return NextResponse.json({ success: false, error: "Missing taskId" }, { status: 400 });
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    // DB times are stored as UTC "HH:mm"; the occurrence date is the user's local date.
    const nowUtcTime = ctx.utcTime(nowDate);
    const today = ctx.localDate(nowDate);

    // 1. Same rule as the app (updateDbTaskActive): at most 2 active tasks per user — keep the most
    //    recently started other task, deactivate the older ones.
    const { data: activeTasks } = await supabase
      .from("tasks")
      .select("id, started_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .neq("id", taskId)
      .order("started_at", { ascending: false });

    if (activeTasks && activeTasks.length >= 2) {
      const idsToDeactivate = activeTasks.slice(1).map((t) => t.id);
      if (idsToDeactivate.length > 0) {
        await supabase
          .from("tasks")
          .update({ is_active: false, started_at: null, updated_at: nowIso })
          .eq("user_id", userId)
          .in("id", idsToDeactivate);
      }
    }

    // 2. Activate the task and sync today's execution start
    const { data, error } = await supabase
      .from("tasks")
      .update({
        is_active: true,
        started_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Task not found" }, { status: 404 });
    }

    const isRecurring = data.recurrence && data.recurrence !== "ONCE";
    if (!isRecurring) {
      await supabase
        .from("tasks")
        .update({ start_time: nowUtcTime, updated_at: nowIso })
        .eq("id", taskId)
        .eq("user_id", userId);
    } else {
      const overrides = data.date_overrides || {};
      await supabase
        .from("tasks")
        .update({
          date_overrides: {
            ...overrides,
            [today]: {
              ...(overrides[today] || {}),
              startTime: nowUtcTime,
            },
          },
          updated_at: nowIso,
        })
        .eq("id", taskId)
        .eq("user_id", userId);
    }

    // Don't reset an existing completion of today (it would drop its accumulated duration).
    const { data: existingComp } = await supabase
      .from("task_completions")
      .select("id, actual_start_time")
      .eq("task_id", taskId)
      .eq("date", today)
      .maybeSingle();
    if (!existingComp) {
      await supabase.from("task_completions").insert([
        {
          task_id: taskId,
          user_id: userId,
          date: today,
          completed: false,
          scheduled_start_time: nowUtcTime,
          actual_start_time: nowUtcTime,
          updated_at: nowIso,
        },
      ]);
    } else if (!existingComp.actual_start_time) {
      await supabase
        .from("task_completions")
        .update({ actual_start_time: nowUtcTime, updated_at: nowIso })
        .eq("id", existingComp.id);
    }

    let title = data.title;
    let description = data.description;

    try {
      if (title && isEncrypted(title)) {
        title = await decryptText(title);
      }
      if (description && isEncrypted(description)) {
        description = await decryptText(description);
      }
    } catch {}

    const targetVal = data.target_value ? Number(data.target_value) : null;
    const durationStr = targetVal ? `${targetVal} ${data.unit || "min"}` : undefined;

    let projectInfo: { name: string; color: string } | null = null;
    if (data.project_id) {
      const { data: pData } = await supabase
        .from("projects")
        .select("name, color")
        .eq("id", data.project_id)
        .maybeSingle();
      if (pData) projectInfo = pData;
    }

    return NextResponse.json({
      success: true,
      task: {
        taskId: data.id,
        taskTitle: title || "Tâche en cours",
        category: data.tag || data.category || "myTrack",
        subtitle: description || projectInfo?.name || data.category || "En cours",
        startedAtTimestamp: Date.now() / 1000.0,
        totalFormattedDuration: durationStr,
        projectId: data.project_id || null,
        projectName: projectInfo?.name || null,
        projectColor: projectInfo?.color || null,
        color: projectInfo?.color || data.color || "#D4F63D",
      }
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
