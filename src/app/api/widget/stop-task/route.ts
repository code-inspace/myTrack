import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

function getAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// POST /api/widget/stop-task
export async function POST(req: NextRequest) {
  try {
    let taskId: string | undefined;
    try {
      const body = await req.json();
      taskId = body?.taskId;
    } catch {}

    const supabase = getAdminClient();

    if (taskId) {
      // Clôturer la tâche spécifique
      await supabase
        .from("tasks")
        .update({
          is_active: false,
          started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    } else {
      // Clôturer toutes les tâches actives s'il n'y a pas d'ID spécifique
      await supabase
        .from("tasks")
        .update({
          is_active: false,
          started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("is_active", true);
    }

    return NextResponse.json({ success: true }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
