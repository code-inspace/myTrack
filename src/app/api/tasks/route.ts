import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

function getAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// GET /api/tasks?userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tasks = await Promise.all(
      (data || []).map(async (row: any) => {
        let title = row.title;
        let description = row.description;
        try {
          if (title && isEncrypted(title)) title = await decryptText(title);
          if (description && isEncrypted(description)) description = await decryptText(description);
        } catch {}

        return {
          id: row.id,
          userId: row.user_id,
          title,
          description,
          tag: row.tag || row.category || "General",
          category: row.tag || row.category || "General",
          startTime: row.start_time || null,
          endTime: row.end_time || null,
          deadline: row.deadline || null,
          priority: row.priority || "NORMAL",
          recurrence: row.recurrence,
          recurrenceConfig: row.recurrence_config || null,
          dateOverrides: row.date_overrides || {},
          trackingType: row.tracking_type,
          targetValue: row.target_value !== null ? parseFloat(row.target_value) : null,
          unit: row.unit || null,
          enableReminders: row.date_overrides?._enableReminders ?? true,
          reminderOffsetMinutes: row.date_overrides?._reminderOffsetMinutes ?? 10,
          reminderTimes: row.date_overrides?._reminderTimes ?? ["11:00", "18:00"],
          isActive: Boolean(row.is_active),
          startedAt: row.started_at || null,
          isArchived: Boolean(row.is_archived),
          sortOrder: row.sort_order ?? null,
          projectId: row.project_id || null,
          projectStatus: row.project_status || null,
          projectCategory: row.project_category || row.date_overrides?._projectCategory || null,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { task, userId } = body;
    const targetUserId = userId || task?.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const taskTag = task.tag || task.category || "General";
    const encryptedTitle = await encryptText(task.title);
    const encryptedDescription = task.description ? await encryptText(task.description) : null;

    const taskOverrides = {
      ...(task.dateOverrides || {}),
      _enableReminders: task.enableReminders !== undefined ? task.enableReminders : false,
      _reminderOffsetMinutes: task.reminderOffsetMinutes !== undefined ? task.reminderOffsetMinutes : 10,
      _reminderTimes: task.reminderTimes || ["11:00", "18:00"],
      _projectCategory: task.projectCategory || null,
      _tag: taskTag,
    };

    const taskDate = task.date || new Date().toISOString().split("T")[0];
    const createdIso = taskDate ? `${taskDate}T12:00:00.000Z` : new Date().toISOString();

    const isValidUuid = (id?: string) =>
      Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    const insertPayload: any = {
      user_id: targetUserId,
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
      date_overrides: taskOverrides,
      tracking_type: task.trackingType || "BOOLEAN",
      target_value: task.targetValue !== undefined && task.targetValue !== null ? Number(task.targetValue) : null,
      unit: task.unit || null,
      is_active: Boolean(task.isActive),
      started_at: task.startedAt || (task.isActive ? new Date().toISOString() : null),
      is_archived: false,
      project_id: isValidUuid(task.projectId) ? task.projectId : null,
      project_status: task.projectId ? task.projectStatus || "TODO" : null,
      project_category: task.projectId ? task.projectCategory || null : null,
      created_at: createdIso,
    };

    if (isValidUuid(task.id)) {
      insertPayload.id = task.id;
    }

    const { data, error } = await supabase.from("tasks").insert([insertPayload]).select().single();

    if (error) {
      console.error("API /api/tasks POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      task: {
        ...task,
        id: data.id,
        userId: data.user_id,
        title: task.title,
        description: task.description,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (err: any) {
    console.error("API /api/tasks POST exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/tasks
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, updates, userId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.isActive !== undefined) {
      dbPayload.is_active = updates.isActive;
    }
    if (updates.startedAt !== undefined) {
      dbPayload.started_at = updates.startedAt;
    }
    if (updates.startTime !== undefined) {
      dbPayload.start_time = updates.startTime;
    }
    if (updates.endTime !== undefined) {
      dbPayload.end_time = updates.endTime;
    }
    if (updates.title !== undefined) {
      dbPayload.title = await encryptText(updates.title);
    }
    if (updates.description !== undefined) {
      dbPayload.description = updates.description ? await encryptText(updates.description) : null;
    }

    let query = supabase.from("tasks").update(dbPayload).eq("id", taskId);
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;
    if (error) {
      console.error("API /api/tasks PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, taskId, updates });
  } catch (err: any) {
    console.error("API /api/tasks PATCH exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/tasks?id=...&userId=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!id || !userId) {
      return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });
    }

    const supabase = getAdminClient();
    await supabase.from("task_completions").delete().eq("task_id", id);
    await supabase.from("reminders").delete().eq("task_id", id);
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
