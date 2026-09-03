import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { encryptText } from "@/lib/crypto/encryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

function getAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// POST /api/tasks/sync: Takes local tasks + completions from client and pushes any missing to DB
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { localTasks = [], localCompletions = [], userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Fetch current DB tasks
    const { data: dbTasks } = await supabase.from("tasks").select("id, title").eq("user_id", userId);
    const dbIds = new Set((dbTasks || []).map((t: any) => t.id));

    const idMapping = new Map<string, string>(); // oldLocalId -> newDbUuid

    const isValidUuid = (id?: string) =>
      Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    // 2. Insert any tasks missing in DB
    for (const task of localTasks) {
      if (!task || !task.title) continue;
      if (dbIds.has(task.id)) continue;

      const encryptedTitle = await encryptText(task.title);
      const encryptedDescription = task.description ? await encryptText(task.description) : null;
      const taskTag = task.tag || task.category || "General";

      const insertPayload: any = {
        user_id: userId,
        title: encryptedTitle,
        description: encryptedDescription,
        tag: taskTag,
        category: taskTag,
        start_time: task.startTime || null,
        end_time: task.endTime || null,
        deadline: task.deadline || null,
        priority: task.priority || "NORMAL",
        recurrence: task.recurrence || "ONCE",
        recurrence_config: task.recurrenceConfig || null,
        date_overrides: task.dateOverrides || {},
        tracking_type: task.trackingType || "BOOLEAN",
        target_value: task.targetValue !== undefined && task.targetValue !== null ? Number(task.targetValue) : null,
        unit: task.unit || null,
        is_active: false,
        started_at: null,
        is_archived: false,
        project_id: isValidUuid(task.projectId) ? task.projectId : null,
        project_status: task.projectId ? task.projectStatus || "TODO" : null,
        project_category: task.projectId ? task.projectCategory || null : null,
        created_at: task.createdAt || new Date().toISOString(),
      };

      if (isValidUuid(task.id)) {
        insertPayload.id = task.id;
      }

      const { data, error } = await supabase.from("tasks").insert([insertPayload]).select().single();
      if (!error && data) {
        if (task.id !== data.id) {
          idMapping.set(task.id, data.id);
        }
      }
    }

    // 3. Sync completions
    for (const comp of localCompletions) {
      if (!comp || !comp.taskId || !comp.date) continue;
      const effectiveTaskId = idMapping.get(comp.taskId) || comp.taskId;
      if (!isValidUuid(effectiveTaskId)) continue;

      const record = {
        task_id: effectiveTaskId,
        user_id: userId,
        date: comp.date,
        completed: Boolean(comp.completed),
        value: comp.value !== undefined ? comp.value : null,
        duration: comp.duration !== undefined ? comp.duration : null,
        notes: comp.notes || null,
        scheduled_start_time: comp.scheduledStartTime || null,
        scheduled_end_time: comp.scheduledEndTime || null,
        actual_start_time: comp.actualStartTime || null,
        actual_end_time: comp.actualEndTime || null,
        updated_at: new Date().toISOString(),
      };

      await supabase.from("task_completions").upsert([record], { onConflict: "task_id,date" });
    }

    return NextResponse.json({
      success: true,
      idMapping: Object.fromEntries(idMapping),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
