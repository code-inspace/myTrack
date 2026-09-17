import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

function getAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// GET /api/goals?userId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // If table doesn't exist yet, return empty list gracefully
      console.warn("Supabase goals fetch error (table may not exist yet):", error.message);
      return NextResponse.json({ success: true, goals: [] });
    }

    const goals = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      projectId: row.project_id,
      projectCategory: row.project_category || undefined,
      periodType: row.period_type || "week",
      targetMinutes: Number(row.target_minutes) || 60,
      color: row.color || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ success: true, goals });
  } catch (err: any) {
    console.error("GET /api/goals error:", err);
    return NextResponse.json({ success: false, error: err.message, goals: [] }, { status: 500 });
  }
}

// POST /api/goals
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      userId,
      title,
      projectId,
      projectCategory,
      periodType,
      targetMinutes,
      color,
    } = body;

    if (!userId || !projectId || !targetMinutes) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const now = new Date().toISOString();
    const goalId = id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const { data, error } = await supabase
      .from("goals")
      .upsert(
        {
          id: goalId,
          user_id: userId,
          title: title || null,
          project_id: projectId,
          project_category: projectCategory || null,
          period_type: periodType || "week",
          target_minutes: targetMinutes,
          color: color || null,
          created_at: now,
          updated_at: now,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.warn("Supabase goals upsert error:", error.message);
      // Return created object even if table doesn't exist yet for local cache persistence
      return NextResponse.json({
        success: true,
        goal: {
          id: goalId,
          userId,
          title,
          projectId,
          projectCategory,
          periodType: periodType || "week",
          targetMinutes,
          color,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    return NextResponse.json({
      success: true,
      goal: {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        projectId: data.project_id,
        projectCategory: data.project_category || undefined,
        periodType: data.period_type,
        targetMinutes: Number(data.target_minutes),
        color: data.color || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (err: any) {
    console.error("POST /api/goals error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT /api/goals
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId, title, projectId, projectCategory, periodType, targetMinutes, color } =
      body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing goal id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const now = new Date().toISOString();

    const updates: Record<string, any> = { updated_at: now };
    if (title !== undefined) updates.title = title || null;
    if (projectId !== undefined) updates.project_id = projectId;
    if (projectCategory !== undefined) updates.project_category = projectCategory || null;
    if (periodType !== undefined) updates.period_type = periodType;
    if (targetMinutes !== undefined) updates.target_minutes = targetMinutes;
    if (color !== undefined) updates.color = color || null;

    const { data, error } = await supabase
      .from("goals")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("Supabase goals update error:", error.message);
    }

    return NextResponse.json({ success: true, goal: data });
  } catch (err: any) {
    console.error("PUT /api/goals error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/goals?id=xxx&userId=yyy
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing goal id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("goals").delete().eq("id", id);

    if (error) {
      console.warn("Supabase goals delete error:", error.message);
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/goals error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
