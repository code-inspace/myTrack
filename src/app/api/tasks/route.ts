import { NextRequest, NextResponse } from "next/server";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";
import { getAdminClient, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { getProjectColumns } from "@/features/projects/types";

const isValidUuid = (id?: string | null) =>
  Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

/** Returns the project row only if it belongs to the user (service-role queries bypass RLS). */
async function getOwnedProject(supabase: ReturnType<typeof getAdminClient>, projectId: string, userId: string) {
  if (!isValidUuid(projectId)) return null;
  const { data } = await supabase
    .from("projects")
    .select("id, columns")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

function getFirstProjectColumnId(project: { columns?: any } | null): string {
  const columns = getProjectColumns({ columns: Array.isArray(project?.columns) ? project!.columns : [] });
  return columns[0]?.id || "TODO";
}

// GET /api/tasks
export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

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
          enableReminders: row.date_overrides?._enableReminders ?? false,
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
    const { task } = body;
    const targetUserId = await getRequestUserId(req);
    if (!targetUserId) return unauthorizedResponse();
    if (!task?.title) {
      return NextResponse.json({ error: "Missing task" }, { status: 400 });
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

    const project = task.projectId ? await getOwnedProject(supabase, task.projectId, targetUserId) : null;

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
      project_id: project ? project.id : null,
      project_status: project ? task.projectStatus || getFirstProjectColumnId(project) : task.projectStatus || null,
      project_category: project ? task.projectCategory || null : null,
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
    const { taskId, updates } = body;

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    if (!taskId || !updates) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: existing } = await supabase
      .from("tasks")
      .select("id, project_id, date_overrides")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };

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

    const requestedProjectId =
      updates.projectId !== undefined ? updates.projectId : updates.project_id;
    const requestedProjectStatus =
      updates.projectStatus !== undefined ? updates.projectStatus : updates.project_status;
    const requestedProjectCategory =
      updates.projectCategory !== undefined ? updates.projectCategory : updates.project_category;

    if (requestedProjectId !== undefined) {
      const project = requestedProjectId
        ? await getOwnedProject(supabase, requestedProjectId, userId)
        : null;
      const isChangingProject = (project?.id || null) !== (existing.project_id || null);
      dbPayload.project_id = project ? project.id : null;
      if (project) {
        dbPayload.project_status =
          requestedProjectStatus !== undefined && requestedProjectStatus !== null
            ? requestedProjectStatus
            : isChangingProject
              ? getFirstProjectColumnId(project)
              : undefined;
        if (dbPayload.project_status === undefined) delete dbPayload.project_status;
        if (requestedProjectCategory !== undefined || isChangingProject) {
          dbPayload.project_category = requestedProjectCategory || null;
        }
      } else {
        // Tasks without a project keep a plain TODO/DONE status (used by the "no project" board).
        dbPayload.project_status = requestedProjectStatus || null;
        dbPayload.project_category = null;
      }
    } else {
      if (requestedProjectStatus !== undefined) {
        dbPayload.project_status = requestedProjectStatus || null;
      }
      if (requestedProjectCategory !== undefined) {
        dbPayload.project_category = existing.project_id ? requestedProjectCategory || null : null;
      }
    }

    // date_overrides holds both per-date entries ("yyyy-MM-dd") and task metadata ("_key").
    // A client sending dateOverrides replaces the per-date entries, but metadata it didn't send
    // is preserved; metadata-only updates are merged into the stored value instead of replacing it.
    const storedOverrides: Record<string, any> =
      existing.date_overrides && typeof existing.date_overrides === "object" ? existing.date_overrides : {};
    const incomingOverrides =
      updates.dateOverrides !== undefined ? updates.dateOverrides : updates.date_overrides;
    let nextOverrides: Record<string, any> | undefined;
    if (incomingOverrides !== undefined) {
      const storedMeta = Object.fromEntries(
        Object.entries(storedOverrides).filter(([key]) => key.startsWith("_")),
      );
      nextOverrides = { ...storedMeta, ...(incomingOverrides || {}) };
    }
    const mergeMeta = (meta: Record<string, any>) => {
      nextOverrides = { ...(nextOverrides || storedOverrides), ...meta };
    };

    if (requestedProjectCategory !== undefined) {
      mergeMeta({ _projectCategory: requestedProjectCategory || null });
    }
    if (updates.isNoProject !== undefined || updates.is_no_project !== undefined) {
      const isNoProj = updates.isNoProject !== undefined ? Boolean(updates.isNoProject) : Boolean(updates.is_no_project);
      mergeMeta({ _isNoProject: isNoProj });
    } else if (requestedProjectId) {
      mergeMeta({ _isNoProject: false });
    }
    if (updates.enableReminders !== undefined) mergeMeta({ _enableReminders: Boolean(updates.enableReminders) });
    if (updates.reminderOffsetMinutes !== undefined) mergeMeta({ _reminderOffsetMinutes: updates.reminderOffsetMinutes });
    if (updates.reminderTimes !== undefined) mergeMeta({ _reminderTimes: updates.reminderTimes });

    if (nextOverrides !== undefined) {
      dbPayload.date_overrides = nextOverrides;
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

    const { error } = await supabase
      .from("tasks")
      .update(dbPayload)
      .eq("id", taskId)
      .eq("user_id", userId);
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

// DELETE /api/tasks?id=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: owned } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    await supabase.from("task_completions").delete().eq("task_id", id);
    await supabase.from("reminders").delete().eq("task_id", id);
    await supabase.from("notification_schedules").delete().eq("task_id", id);
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);

    if (error) {
      console.error("API /api/tasks DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("API /api/tasks DELETE exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
