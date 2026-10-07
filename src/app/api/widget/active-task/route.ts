import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { resolveWidgetContext } from "@/lib/supabase/widgetContext";
import { decryptText, isEncrypted } from "@/lib/crypto/encryption";


// GET /api/widget/active-task
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveWidgetContext(req);
    if (!ctx) return unauthorizedResponse();
    const { supabase, userId } = ctx;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return NextResponse.json({ active: false, task: null }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    const row = data[0];
    let title = row.title;
    let description = row.description;

    try {
      if (title && isEncrypted(title)) {
        title = await decryptText(title);
      }
      if (description && isEncrypted(description)) {
        description = await decryptText(description);
      }
    } catch {}

    let startedAtTimestamp = Date.now() / 1000.0;
    if (row.started_at) {
      const parsed = new Date(row.started_at).getTime();
      if (!isNaN(parsed)) {
        startedAtTimestamp = parsed / 1000.0;
      }
    }

    const targetVal = row.target_value ? Number(row.target_value) : null;
    const durationStr = targetVal ? `${targetVal} ${row.unit || "min"}` : undefined;

    let projectInfo: { name: string; color: string } | null = null;
    if (row.project_id) {
      const { data: pData } = await supabase
        .from("projects")
        .select("name, color")
        .eq("id", row.project_id)
        .maybeSingle();
      if (pData) projectInfo = pData;
    }

    return NextResponse.json({
      active: true,
      task: {
        taskId: row.id,
        taskTitle: title || "Tâche en cours",
        category: row.tag || row.category || "myTrack",
        subtitle: description || row.category || "En cours",
        startedAtTimestamp,
        totalFormattedDuration: durationStr,
        projectId: row.project_id || null,
        projectName: projectInfo?.name || null,
        projectColor: projectInfo?.color || null,
        color: projectInfo?.color || row.color || "#D4F63D",
      },
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ active: false, error: err?.message }, { status: 500 });
  }
}
