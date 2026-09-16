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
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (taskId) {
      const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
      let actualStart = nowTime;
      let durationMinutes = 1;

      if (task?.started_at) {
        const startDate = new Date(task.started_at);
        if (!isNaN(startDate.getTime())) {
          actualStart = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
          durationMinutes = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / 60000));
        }
      } else if (task?.start_time) {
        actualStart = task.start_time;
      }

      // 1. Deactivate task
      await supabase
        .from("tasks")
        .update({
          is_active: false,
          started_at: null,
          updated_at: now.toISOString(),
        })
        .eq("id", taskId);

      // 2. Record completion
      if (task?.user_id) {
        await supabase.from("task_completions").upsert(
          [
            {
              task_id: taskId,
              user_id: task.user_id,
              date: today,
              completed: true,
              duration: durationMinutes,
              actual_start_time: actualStart,
              actual_end_time: nowTime,
              scheduled_start_time: actualStart,
              scheduled_end_time: nowTime,
              updated_at: now.toISOString(),
            },
          ],
          { onConflict: "task_id,date" }
        );

        // 3. Sync project status if linked to a project
        if (task.project_id) {
          try {
            const { data: project } = await supabase
              .from("projects")
              .select("columns")
              .eq("id", task.project_id)
              .maybeSingle();

            let doneColumnId = "DONE";
            if (project?.columns && Array.isArray(project.columns)) {
              const doneCol = project.columns.find((c: any) => c.isDone) || project.columns[project.columns.length - 1];
              if (doneCol?.id) doneColumnId = doneCol.id;
            }

            await supabase
              .from("tasks")
              .update({ project_status: doneColumnId, updated_at: now.toISOString() })
              .eq("id", taskId);
          } catch (projErr) {
            console.warn("stop-task project sync error:", projErr);
          }
        }
      }
    } else {
      // Clôturer toutes les tâches actives s'il n'y a pas d'ID spécifique
      const { data: activeTasks } = await supabase.from("tasks").select("*").eq("is_active", true);

      await supabase
        .from("tasks")
        .update({
          is_active: false,
          started_at: null,
          updated_at: now.toISOString(),
        })
        .eq("is_active", true);

      if (activeTasks && activeTasks.length > 0) {
        const completionRecords = activeTasks.map((task: any) => {
          let actualStart = nowTime;
          let durationMinutes = 1;
          if (task.started_at) {
            const startDate = new Date(task.started_at);
            if (!isNaN(startDate.getTime())) {
              actualStart = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
              durationMinutes = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / 60000));
            }
          } else if (task.start_time) {
            actualStart = task.start_time;
          }
          return {
            task_id: task.id,
            user_id: task.user_id,
            date: today,
            completed: true,
            duration: durationMinutes,
            actual_start_time: actualStart,
            actual_end_time: nowTime,
            scheduled_start_time: actualStart,
            scheduled_end_time: nowTime,
            updated_at: now.toISOString(),
          };
        });

        await supabase.from("task_completions").upsert(completionRecords, { onConflict: "task_id,date" });
      }
    }

    return NextResponse.json({ success: true }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
