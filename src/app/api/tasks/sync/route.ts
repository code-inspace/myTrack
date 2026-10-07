import { NextRequest, NextResponse } from "next/server";
import { encryptText } from "@/lib/crypto/encryption";
import { getAdminClient, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

// POST /api/tasks/sync: Takes local tasks + completions from client and pushes any missing to DB
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { localTasks = [], localCompletions = [] } = body;

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    const supabase = getAdminClient();

    // 1. Fetch current DB tasks
    const { data: dbTasks } = await supabase.from("tasks").select("id, title").eq("user_id", userId);
    const dbIds = new Set((dbTasks || []).map((t: any) => t.id));
    const { data: ownedProjects } = await supabase.from("projects").select("id").eq("user_id", userId);
    const ownedProjectIds = new Set((ownedProjects || []).map((p: any) => p.id));

    const idMapping = new Map<string, string>(); // oldLocalId -> newDbUuid

    const isValidUuid = (id?: string) =>
      Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    // 2. Insert any genuinely newly created offline tasks missing in DB
    for (const task of localTasks) {
      if (!task || !task.title) continue;
      if (dbIds.has(task.id)) continue;
      // Do not recreate tasks that already had a UUID and were deleted from DB
      if (isValidUuid(task.id)) continue;

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
        project_id: ownedProjectIds.has(task.projectId) ? task.projectId : null,
        project_status: task.projectStatus || (ownedProjectIds.has(task.projectId) ? "TODO" : null),
        project_category: ownedProjectIds.has(task.projectId) ? task.projectCategory || null : null,
        created_at: task.createdAt || new Date().toISOString(),
      };

      if (isValidUuid(task.id)) {
        insertPayload.id = task.id;
      }

      const { data, error } = await supabase.from("tasks").insert([insertPayload]).select().single();
      if (!error && data) {
        dbIds.add(data.id);
        if (task.id !== data.id) {
          idMapping.set(task.id, data.id);
        }
      }
    }

    // 3. Sync completions
    for (const comp of localCompletions) {
      if (!comp || !comp.taskId || !comp.date) continue;
      const effectiveTaskId = idMapping.get(comp.taskId) || comp.taskId;
      if (!isValidUuid(effectiveTaskId) || !dbIds.has(effectiveTaskId)) continue;

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
