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

// GET /api/widget/tasks
export async function GET(_req: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data) {
      console.error("[api/widget/tasks] Supabase error:", error);
      return NextResponse.json({ tasks: [] }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    const decryptedTasks = await Promise.all(
      data.map(async (row) => {
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

        const targetVal = row.target_value ? Number(row.target_value) : null;
        const durationStr = targetVal ? `${targetVal} ${row.unit || "min"}` : undefined;

        return {
          id: row.id,
          title: title || "Tâche",
          category: row.tag || row.category || "myTrack",
          subtitle: description || row.category || "Routine",
          targetFormattedDuration: durationStr,
          isHabit: row.is_habit ?? false,
          color: row.color ?? "#D4F63D",
        };
      })
    );

    return NextResponse.json({ tasks: decryptedTasks }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ tasks: [], error: err?.message }, { status: 500 });
  }
}
