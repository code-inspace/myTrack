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

    const isValidUuid = (id?: string | null) =>
      Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (updates.isActive !== undefined) {
      dbPayload.is_active = Boolean(updates.isActive);
    } else if (updates.is_active !== undefined) {
      dbPayload.is_active = Boolean(updates.is_active);
    }

    if (updates.startedAt !== undefined) {
      dbPayload.started_at = updates.startedAt;
    } else if (updates.started_at !== undefined) {
      dbPayload.started_at = updates.started_at;
    }

    if (updates.startTime !== undefined) {
      dbPayload.start_time = updates.startTime;
    } else if (updates.start_time !== undefined) {
      dbPayload.start_time = updates.start_time;
    }

    if (updates.endTime !== undefined) {
      dbPayload.end_time = updates.endTime;
    } else if (updates.end_time !== undefined) {
      dbPayload.end_time = updates.end_time;
    }

    if (updates.deadline !== undefined) {
      dbPayload.deadline = updates.deadline || null;
    }

    if (updates.priority !== undefined) {
      dbPayload.priority = updates.priority || "NORMAL";
    }

    if (updates.recurrence !== undefined) {
      dbPayload.recurrence = updates.recurrence;
    }

    if (updates.recurrenceConfig !== undefined) {
      dbPayload.recurrence_config = updates.recurrenceConfig;
    } else if (updates.recurrence_config !== undefined) {
      dbPayload.recurrence_config = updates.recurrence_config;
    }

    if (updates.trackingType !== undefined) {
      dbPayload.tracking_type = updates.trackingType;
    } else if (updates.tracking_type !== undefined) {
      dbPayload.tracking_type = updates.tracking_type;
    }

    if (updates.targetValue !== undefined) {
      dbPayload.target_value = updates.targetValue !== null ? Number(updates.targetValue) : null;
    } else if (updates.target_value !== undefined) {
      dbPayload.target_value = updates.target_value !== null ? Number(updates.target_value) : null;
    }

    if (updates.unit !== undefined) {
      dbPayload.unit = updates.unit || null;
    }

    if (updates.tag !== undefined) {
      dbPayload.tag = updates.tag;
      dbPayload.category = updates.tag;
    } else if (updates.category !== undefined) {
      dbPayload.tag = updates.category;
      dbPayload.category = updates.category;
    }

    if (updates.projectId !== undefined) {
      dbPayload.project_id = isValidUuid(updates.projectId) ? updates.projectId : null;
      dbPayload.project_status = updates.projectId
        ? updates.projectStatus !== undefined
          ? updates.projectStatus
          : "TODO"
        : null;
      dbPayload.project_category = updates.projectId
        ? updates.projectCategory !== undefined
          ? updates.projectCategory
          : null
        : null;
    } else if (updates.project_id !== undefined) {
      dbPayload.project_id = isValidUuid(updates.project_id) ? updates.project_id : null;
      if (updates.project_status !== undefined) {
        dbPayload.project_status = updates.project_status;
      }
      if (updates.project_category !== undefined) {
        dbPayload.project_category = updates.project_category;
      }
    } else {
      if (updates.projectStatus !== undefined) {
        dbPayload.project_status = updates.projectStatus || null;
      } else if (updates.project_status !== undefined) {
        dbPayload.project_status = updates.project_status || null;
      }
      if (updates.projectCategory !== undefined) {
        dbPayload.project_category = updates.projectCategory || null;
      } else if (updates.project_category !== undefined) {
        dbPayload.project_category = updates.project_category || null;
      }
    }

    if (updates.dateOverrides !== undefined) {
      dbPayload.date_overrides = updates.dateOverrides;
    } else if (updates.date_overrides !== undefined) {
      dbPayload.date_overrides = updates.date_overrides;
    }

    if (updates.projectCategory !== undefined || updates.project_category !== undefined) {
      const cat = updates.projectCategory !== undefined ? updates.projectCategory : updates.project_category;
      dbPayload.date_overrides = {
        ...(dbPayload.date_overrides || {}),
        _projectCategory: cat || null,
      };
    }

    if (updates.createdAt !== undefined) {
      dbPayload.created_at = updates.createdAt;
    } else if (updates.created_at !== undefined) {
      dbPayload.created_at = updates.created_at;
    }

    if (updates.isArchived !== undefined) {
      dbPayload.is_archived = Boolean(updates.isArchived);
    } else if (updates.is_archived !== undefined) {
      dbPayload.is_archived = Boolean(updates.is_archived);
    }

    if (updates.sortOrder !== undefined) {
      dbPayload.sort_order = updates.sortOrder;
    } else if (updates.sort_order !== undefined) {
      dbPayload.sort_order = updates.sort_order;
    }

    if (updates.title !== undefined) {
      dbPayload.title = await encryptText(updates.title);
    }
    if (updates.description !== undefined) {
      dbPayload.description = updates.description ? await encryptText(updates.description) : null;
    }

    const { error } = await supabase.from("tasks").update(dbPayload).eq("id", taskId);
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

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    await supabase.from("task_completions").delete().eq("task_id", id);
    await supabase.from("reminders").delete().eq("task_id", id);
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
