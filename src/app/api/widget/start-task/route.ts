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

    // 1. Désactiver toutes les autres tâches en cours
    await supabase
      .from("tasks")
      .update({ is_active: false, updated_at: now })
      .eq("is_active", true);

    // 2. Activer la tâche sélectionnée
    const { data, error } = await supabase
      .from("tasks")
      .update({
        is_active: true,
        started_at: now,
        updated_at: now,
      })
      .eq("id", taskId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
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

    return NextResponse.json({
      success: true,
      task: {
        taskId: data.id,
        taskTitle: title || "Tâche en cours",
        category: data.tag || data.category || "myTrack",
        subtitle: description || data.category || "En cours",
        startedAtTimestamp: Date.now() / 1000.0,
        totalFormattedDuration: durationStr,
      }
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
