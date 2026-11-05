import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { resolveWidgetContext, getProjectDoneColumnId, WidgetContext } from "@/lib/supabase/widgetContext";
import {
  ActivityEvent,
  ActivityOrigin,
  evaluatePing,
  isValidOrigin,
  normalizeSourceKey,
} from "@/lib/activity/sessions";

interface SourceRow {
  id: string;
  key: string;
  project_id: string | null;
  task_id: string | null;
  enabled: boolean;
}

/** Finds the source of a key, creating it (with its project) the first time the key is seen. */
async function getOrCreateSource(ctx: WidgetContext, key: string): Promise<SourceRow> {
  const { supabase, userId } = ctx;
  const { data: existing } = await supabase
    .from("activity_sources")
    .select("id, key, project_id, task_id, enabled")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (existing) return existing as SourceRow;

  const { data: created, error } = await supabase
    .from("activity_sources")
    .upsert({ user_id: userId, key }, { onConflict: "user_id,key", ignoreDuplicates: false })
    .select("id, key, project_id, task_id, enabled")
    .single();
  if (error || !created) throw new Error(error?.message || "Could not create activity source");
  return created as SourceRow;
}

/** Makes sure the source has a project and a task to receive minutes. */
async function ensureTarget(ctx: WidgetContext, source: SourceRow): Promise<{ projectId: string; taskId: string }> {
  const { supabase, userId } = ctx;
  let projectId = source.project_id;
  let taskId = source.task_id;

  if (!projectId) {
    const { data: project, error } = await supabase
      .from("projects")
      .insert({ user_id: userId, name: source.key })
      .select("id")
      .single();
    if (error || !project) throw new Error(error?.message || "Could not create project");
    projectId = project.id as string;
  }

  if (taskId) {
    // The task must still exist and belong to the mapped project (the mapping may have changed).
    const { data: task } = await supabase
      .from("tasks")
      .select("id, project_id, is_archived")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!task || task.is_archived || task.project_id !== projectId) taskId = null;
  }

  if (!taskId) {
    const doneColumn = await getProjectDoneColumnId(supabase, projectId);
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: `Travail — ${source.key}`,
        category: "Work",
        project_id: projectId,
        project_status: doneColumn,
        recurrence: "ONCE",
        tracking_type: "DURATION",
        unit: "min",
      })
      .select("id")
      .single();
    if (error || !task) throw new Error(error?.message || "Could not create task");
    taskId = task.id as string;
  }

  if (projectId !== source.project_id || taskId !== source.task_id) {
    await supabase
      .from("activity_sources")
      .update({ project_id: projectId, task_id: taskId, updated_at: new Date().toISOString() })
      .eq("id", source.id)
      .eq("user_id", userId);
  }
  return { projectId, taskId };
}

async function creditMinutes(ctx: WidgetContext, taskId: string, minutes: number, sessionStart: Date, now: Date) {
  const { supabase, userId } = ctx;
  const date = ctx.localDate(now);
  const nowUtc = ctx.utcTime(now);
  const { data: existing } = await supabase
    .from("task_completions")
    .select("duration, completed, actual_start_time")
    .eq("task_id", taskId)
    .eq("date", date)
    .maybeSingle();

  const previous = existing?.completed && typeof existing.duration === "number" ? existing.duration : 0;
  const start = existing?.actual_start_time || ctx.utcTime(sessionStart);
  await supabase.from("task_completions").upsert(
    [
      {
        task_id: taskId,
        user_id: userId,
        date,
        completed: true,
        duration: previous + minutes,
        actual_start_time: start,
        actual_end_time: nowUtc,
        updated_at: now.toISOString(),
      },
    ],
    { onConflict: "task_id,date" },
  );
}

/** Dev apps heartbeat from http://localhost:<port>; only local origins get CORS (auth is the token). */
function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Widget-Token",
    Vary: "Origin",
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// POST /api/activity/ping  { key, origin: "claude-code" | "web", event?: "ping" | "end" }
// Sent by Claude Code hooks and by app heartbeats (auth: X-Widget-Token).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await resolveWidgetContext(req, body);
    if (!ctx) {
      const denied = unauthorizedResponse();
      Object.entries(corsHeaders(req)).forEach(([k, v]) => denied.headers.set(k, v));
      return denied;
    }
    const { supabase, userId } = ctx;

    const key = normalizeSourceKey(body?.key);
    const origin: ActivityOrigin | null = isValidOrigin(body?.origin) ? body.origin : null;
    const event: ActivityEvent = body?.event === "end" ? "end" : "ping";
    if (!key || !origin) {
      return NextResponse.json({ success: false, error: "Missing or invalid key/origin" }, { status: 400, headers: corsHeaders(req) });
    }

    const source = await getOrCreateSource(ctx, key);
    if (!source.enabled) {
      return NextResponse.json({ success: true, tracked: false }, { headers: { "Cache-Control": "no-store", ...corsHeaders(req) } });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const { data: openRow } = await supabase
      .from("activity_sessions")
      .select("id, started_at, last_ping_at, seconds, credited_minutes")
      .eq("user_id", userId)
      .eq("source_key", key)
      .is("ended_at", null)
      .order("last_ping_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const open = openRow
      ? {
          startedAt: new Date(openRow.started_at),
          lastPingAt: new Date(openRow.last_ping_at),
          seconds: openRow.seconds as number,
          creditedMinutes: openRow.credited_minutes as number,
        }
      : null;
    const outcome = evaluatePing(open, now, origin);

    // Sessions left open by a vanished client (any other open row of this key) end at their last ping.
    if (openRow && outcome.closePrevious) {
      await supabase
        .from("activity_sessions")
        .update({ ended_at: openRow.last_ping_at, ended_by: "idle" })
        .eq("id", openRow.id)
        .eq("user_id", userId);
    }

    let sessionId: string;
    let sessionStart: Date;
    if (openRow && !outcome.closePrevious) {
      sessionId = openRow.id as string;
      sessionStart = open!.startedAt;
      await supabase
        .from("activity_sessions")
        .update({
          last_ping_at: nowIso,
          seconds: outcome.totalSeconds,
          credited_minutes: outcome.creditedMinutes,
          ...(event === "end" ? { ended_at: nowIso, ended_by: "event" } : {}),
        })
        .eq("id", sessionId)
        .eq("user_id", userId);
    } else {
      // An "end" with no session to end (or after an idle close) has nothing to start.
      if (event === "end") {
        return NextResponse.json({ success: true, tracked: true, minutes: 0 }, { headers: { "Cache-Control": "no-store", ...corsHeaders(req) } });
      }
      const { data: created, error } = await supabase
        .from("activity_sessions")
        .insert({
          user_id: userId,
          source_key: key,
          origin,
          started_at: nowIso,
          last_ping_at: nowIso,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "Could not start session");
      sessionId = created.id as string;
      sessionStart = now;
    }

    if (outcome.minutesToCredit > 0) {
      const { taskId } = await ensureTarget(ctx, source);
      await creditMinutes(ctx, taskId, outcome.minutesToCredit, sessionStart, now);
    } else if (!source.project_id || !source.task_id) {
      // First ping of a new key: create its project/task now so it shows up in MyTrack right away.
      await ensureTarget(ctx, source);
    }

    return NextResponse.json(
      { success: true, tracked: true, session: sessionId, minutes: outcome.creditedMinutes },
      { headers: { "Cache-Control": "no-store", ...corsHeaders(req) } },
    );
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error)?.message }, { status: 500 });
  }
}
