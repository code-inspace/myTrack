import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { decryptText, isEncrypted } from "@/lib/crypto/encryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

function getAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// POST /api/widget/start-task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const taskId = body?.taskId;

    if (!taskId) {
      return NextResponse.json({ success: false, error: "Missing taskId" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const now = new Date().toISOString();

    // 1. Si plus d'1 autre tâche est en cours, désactiver les plus anciennes pour garder au max 2 tâches actives au total
    const { data: activeTasks } = await supabase
      .from("tasks")
      .select("id, started_at")
      .eq("is_active", true)
      .neq("id", taskId)
      .order("started_at", { ascending: false });

    if (activeTasks && activeTasks.length >= 2) {
      const idsToDeactivate = activeTasks.slice(1).map((t) => t.id);
      if (idsToDeactivate.length > 0) {
        await supabase
          .from("tasks")
          .update({ is_active: false, started_at: null, updated_at: now })
          .in("id", idsToDeactivate);
      }
    }

    // 2. Activer la tâche sélectionnée et synchroniser le début d'exécution pour aujourd'hui
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const nowTime = `${String(nowDate.getHours()).padStart(2, "0")}:${String(nowDate.getMinutes()).padStart(2, "0")}`;
    const today = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(nowDate.getDate()).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("tasks")
      .update({
        is_active: true,
        started_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", taskId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
    }

    if (data.user_id) {
      const isRecurring = data.recurrence && data.recurrence !== "ONCE";
      if (!isRecurring) {
        await supabase
          .from("tasks")
          .update({
            start_time: nowTime,
            updated_at: nowIso,
          })
          .eq("id", taskId);
      } else {
        const overrides = data.date_overrides || {};
        await supabase
          .from("tasks")
          .update({
            date_overrides: {
              ...overrides,
              [today]: {
                ...(overrides[today] || {}),
                startTime: nowTime,
              },
            },
            updated_at: nowIso,
          })
          .eq("id", taskId);
      }

      await supabase.from("task_completions").upsert(
        [
          {
            task_id: taskId,
            user_id: data.user_id,
            date: today,
            completed: false,
            scheduled_start_time: nowTime,
            actual_start_time: nowTime,
            updated_at: nowIso,
          },
        ],
        { onConflict: "task_id,date" }
      );
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
