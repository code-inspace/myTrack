import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { resolveWidgetContext } from "@/lib/supabase/widgetContext";
import { decryptText, isEncrypted } from "@/lib/crypto/encryption";
import { fetchCalDavOrIcs } from "@/features/calendar/lib/caldavClient";
import { subDays, addDays } from "date-fns";


// GET /api/widget/tasks
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveWidgetContext(req);
    if (!ctx) return unauthorizedResponse();
    const { supabase, userId } = ctx;

    // 1. Fetch active tasks & projects
    const [{ data: taskRows }, { data: projectRows }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("projects")
        .select("id, name, color")
        .eq("user_id", userId),
    ]);

    const projectMap = new Map((projectRows || []).map((p: any) => [p.id, p]));

    const decryptedTasks = taskRows
      ? await Promise.all(
          taskRows.map(async (row) => {
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
            const project = row.project_id ? projectMap.get(row.project_id) : null;

            return {
              id: row.id,
              title: title || "Tâche",
              category: row.tag || row.category || "myTrack",
              subtitle: description || row.category || "Routine",
              targetFormattedDuration: durationStr,
              isHabit: row.is_habit ?? false,
              color: project?.color || row.color || "#D4F63D",
              projectId: row.project_id || null,
              projectName: project?.name || null,
              projectColor: project?.color || null,
              isExternal: false,
            };
          })
        )
      : [];

    // 2. Fetch active external calendar subscriptions & today's events
    const externalEventItems: any[] = [];
    try {
      const { data: subRows } = await supabase
        .from("calendar_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("enabled", true);

      if (subRows && subRows.length > 0) {
        const today = new Date();
        const subs = await Promise.all(
          subRows.map(async (row) => {
            let url = row.url;
            let name = row.name;
            try {
              if (url && isEncrypted(url)) url = await decryptText(url);
              if (name && isEncrypted(name)) name = await decryptText(name);
            } catch {}
            return {
              id: row.id,
              name: name || "Agenda",
              url: url || "",
              color: row.color || "#3B82F6",
              enabled: Boolean(row.enabled),
              username: row.username,
              password: row.password,
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString(),
            };
          })
        );

        const validSubs = subs.filter((s) => s.url?.trim());
        if (validSubs.length > 0) {
          const rangeStart = subDays(today, 1);
          const rangeEnd = addDays(today, 1);
          const todayStr = ctx.localDate(today);

          await Promise.all(
            validSubs.map(async (sub) => {
              try {
                const res = await fetchCalDavOrIcs(sub, rangeStart, rangeEnd);
                if (res.success && res.events) {
                  const todayEvents = res.events.filter((e) => e.date === todayStr);
                  for (const evt of todayEvents) {
                    const timeLabel = evt.isAllDay
                      ? "Toute la journée"
                      : evt.startTime && evt.endTime
                      ? `${evt.startTime} - ${evt.endTime}`
                      : evt.startTime || "Événement";

                    const project = (evt as any).projectId ? projectMap.get((evt as any).projectId) : null;
                    externalEventItems.push({
                      id: `ext_${evt.id}`,
                      title: evt.title || "Événement",
                      category: evt.calendarName || "Agenda",
                      subtitle: timeLabel,
                      targetFormattedDuration: timeLabel,
                      isHabit: false,
                      isExternal: true,
                      color: project?.color || evt.calendarColor || sub.color || "#3B82F6",
                      projectId: (evt as any).projectId || null,
                      projectName: project?.name || null,
                      projectColor: project?.color || null,
                    });
                  }
                }
              } catch (subErr) {
                console.warn("[api/widget/tasks] Feed fetch failed for:", sub.name, subErr);
              }
            })
          );
        }
      }
    } catch (calErr) {
      console.warn("[api/widget/tasks] Calendar fetch error:", calErr);
    }

    const allWidgetItems = [...externalEventItems, ...decryptedTasks];

    return NextResponse.json({ tasks: allWidgetItems }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ tasks: [], error: err?.message }, { status: 500 });
  }
}
