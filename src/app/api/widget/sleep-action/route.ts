import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { convertLocalTimeToUtc } from "@/lib/dates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

function getAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// POST /api/widget/sleep-action
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[API Widget Sleep Action] Received sleep action:", body);

    const action = body?.action; // "NOT_SLEEPING" | "BEDTIME_NOW" | "WAKE_NOW"
    const time = body?.time;
    const timestamp = body?.timestamp;

    const supabase = getAdminClient();
    const now = timestamp ? new Date(timestamp * 1000) : new Date();
    const nowTimeStr = time || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Récupérer le user principal de l'application
    let userId = body?.userId;
    if (!userId) {
      const { data: latestLog } = await supabase
        .from("sleep_logs")
        .select("user_id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestLog?.user_id) {
        userId = latestLog.user_id;
      } else {
        const { data: firstUser } = await supabase.from("users").select("id").limit(1).maybeSingle();
        userId = firstUser?.id;
      }
    }

    if (userId) {
      const utcNowTime = convertLocalTimeToUtc(nowTimeStr, todayStr);

      if (action === "NOT_SLEEPING") {
        // L'utilisateur a cliqué sur "Je ne dors pas" :
        // Valider le réveil du matin, annuler tout 2ème sommeil, et persister dans sleep_logs
        const { data: existingLog } = await supabase
          .from("sleep_logs")
          .select("*")
          .eq("user_id", userId)
          .eq("date", todayStr)
          .maybeSingle();

        // Clôturer tous les naps en cours s'il y en a
        let naps = Array.isArray(existingLog?.naps) ? existingLog.naps : [];
        naps = naps.map((n: any) => ({
          ...n,
          endTime: n.endTime || utcNowTime,
        }));

        await supabase.from("sleep_logs").upsert(
          [
            {
              user_id: userId,
              date: todayStr,
              bedtime: existingLog?.bedtime || convertLocalTimeToUtc("23:00", todayStr),
              wake_time: existingLog?.wake_time || utcNowTime,
              bedtime_validated: Boolean(existingLog?.bedtime_validated),
              wake_time_validated: true,
              naps,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "user_id,date" }
        );
      } else if (action === "WAKE_NOW") {
        const { data: existingLog } = await supabase
          .from("sleep_logs")
          .select("*")
          .eq("user_id", userId)
          .eq("date", todayStr)
          .maybeSingle();

        await supabase.from("sleep_logs").upsert(
          [
            {
              user_id: userId,
              date: todayStr,
              bedtime: existingLog?.bedtime || convertLocalTimeToUtc("23:00", todayStr),
              wake_time: utcNowTime,
              bedtime_validated: Boolean(existingLog?.bedtime_validated),
              wake_time_validated: true,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "user_id,date" }
        );
      } else if (action === "BEDTIME_NOW") {
        const { data: existingLog } = await supabase
          .from("sleep_logs")
          .select("*")
          .eq("user_id", userId)
          .eq("date", todayStr)
          .maybeSingle();

        await supabase.from("sleep_logs").upsert(
          [
            {
              user_id: userId,
              date: todayStr,
              bedtime: utcNowTime,
              wake_time: existingLog?.wake_time || convertLocalTimeToUtc("07:00", todayStr),
              bedtime_validated: true,
              wake_time_validated: false,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "user_id,date" }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        action,
        time: nowTimeStr,
        date: todayStr,
        userId,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("[API Widget Sleep Action Error]:", error);
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 400 });
  }
}
