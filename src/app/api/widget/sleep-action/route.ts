import { NextRequest, NextResponse } from "next/server";
import { convertZonedTimeToUtc, getZonedDateTimeParts } from "@/lib/dates";
import { format, subDays, parseISO } from "date-fns";
import { unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { resolveWidgetContext } from "@/lib/supabase/widgetContext";
import { isAfterMidnightBedtime } from "@/features/sleep/sleepRules";

// POST /api/widget/sleep-action
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[API Widget Sleep Action] Received sleep action:", body);

    const action = body?.action; // "NOT_SLEEPING" | "BEDTIME_NOW" | "WAKE_NOW"
    const time = body?.time;
    const timestamp = body?.timestamp;

    // The user is the authenticated one — never "the last active user" or "the first user".
    const ctx = await resolveWidgetContext(req, body);
    if (!ctx) return unauthorizedResponse();
    const { supabase, userId, timeZone } = ctx;

    const now = timestamp ? new Date(timestamp * 1000) : new Date();
    const zonedNow = getZonedDateTimeParts(now, timeZone);
    const nowTimeStr = time || zonedNow.timeStr;
    const todayStr = zonedNow.dateStr;
    const isAfterMidnight = isAfterMidnightBedtime(nowTimeStr);
    const bedDateForNow = isAfterMidnight
      ? format(subDays(parseISO(todayStr), 1), "yyyy-MM-dd")
      : todayStr;

    if (userId) {
      const utcNowTime = convertZonedTimeToUtc(nowTimeStr, todayStr, timeZone);

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
              bedtime: existingLog?.bedtime ?? null,
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
              bedtime: existingLog?.bedtime ?? null,
              wake_time: utcNowTime,
              bedtime_validated: Boolean(existingLog?.bedtime_validated),
              wake_time_validated: true,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "user_id,date" }
        );
      } else if (action === "BEDTIME_NOW") {
        const targetBedDate = bedDateForNow;

        const { data: existingLog } = await supabase
          .from("sleep_logs")
          .select("*")
          .eq("user_id", userId)
          .eq("date", targetBedDate)
          .maybeSingle();

        await supabase.from("sleep_logs").upsert(
          [
            {
              user_id: userId,
              date: targetBedDate,
              bedtime: utcNowTime,
              wake_time: existingLog?.wake_time ?? null,
              bedtime_validated: true,
              wake_time_validated: false,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "user_id,date" }
        );
      }
    }

    const effectiveDate = action === "BEDTIME_NOW" ? bedDateForNow : todayStr;

    return NextResponse.json(
      {
        success: true,
        action,
        time: nowTimeStr,
        date: effectiveDate,
        userId,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("[API Widget Sleep Action Error]:", error);
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 400 });
  }
}
