import { NextRequest, NextResponse } from "next/server";

import { getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

// Goals are stored in the auth user's metadata (not the `goals` table), via the Auth admin API.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

function getAdminHeaders() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function getGoalsForUser(userId: string): Promise<any[]> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "GET",
      headers: getAdminHeaders(),
    });
    if (res.ok) {
      const user = await res.json();
      const goals = user?.user_metadata?.goals;
      if (Array.isArray(goals)) {
        return goals;
      }
    }
  } catch (e) {
    console.error("[API Goals] Error fetching user goals:", e);
  }
  return [];
}

async function saveGoalsForUser(userId: string, goals: any[]): Promise<boolean> {
  try {
    // 1. Get current metadata to preserve existing fields
    const getRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "GET",
      headers: getAdminHeaders(),
    });
    let currentMetadata = {};
    if (getRes.ok) {
      const user = await getRes.json();
      currentMetadata = user?.user_metadata || {};
    }

    // 2. Update with new goals list
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: getAdminHeaders(),
      body: JSON.stringify({
        user_metadata: {
          ...currentMetadata,
          goals,
        },
      }),
    });

    return updateRes.ok;
  } catch (e) {
    console.error("[API Goals] Error saving user goals:", e);
    return false;
  }
}

// GET /api/goals
export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    const goals = await getGoalsForUser(userId);
    return NextResponse.json(
      { success: true, goals },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
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
      title,
      projectId,
      projectCategory,
      projectCategories,
      periodType,
      periodKey,
      isRecurring = true,
      targetType = "duration",
      targetMinutes,
      targetCount,
      unit,
      color,
    } = body;

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    if (!projectId || (!targetMinutes && !targetCount)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const resolvedCategories: string[] | null = Array.isArray(projectCategories) && projectCategories.length > 0
      ? projectCategories
      : projectCategory
      ? [projectCategory]
      : null;

    const now = new Date().toISOString();
    const goalId = id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newGoal = {
      id: goalId,
      userId,
      title: title || null,
      projectId,
      projectCategory: (resolvedCategories && resolvedCategories.length === 1) ? resolvedCategories[0] : (projectCategory || null),
      projectCategories: resolvedCategories,
      periodType: periodType || "week",
      periodKey: periodKey || null,
      isRecurring: Boolean(isRecurring),
      targetType: targetType || "duration",
      targetMinutes: Number(targetMinutes) || 60,
      targetCount: targetCount ? Number(targetCount) : null,
      unit: unit || null,
      color: color || null,
      createdAt: now,
      updatedAt: now,
    };

    const currentGoals = await getGoalsForUser(userId);
    const updatedGoals = [newGoal, ...currentGoals.filter((g: any) => g.id !== goalId)];
    await saveGoalsForUser(userId, updatedGoals);

    return NextResponse.json({
      success: true,
      goal: newGoal,
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
    const {
      id,
      title,
      projectId,
      projectCategory,
      projectCategories,
      periodType,
      periodKey,
      isRecurring,
      targetType,
      targetMinutes,
      targetCount,
      unit,
      color,
    } = body;

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing goal id" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const currentGoals = await getGoalsForUser(userId);
    const existingIndex = currentGoals.findIndex((g: any) => g.id === id);

    let updatedGoal: any = null;

    if (existingIndex >= 0) {
      const resolvedCategories: string[] | null | undefined =
        projectCategories !== undefined
          ? (Array.isArray(projectCategories) && projectCategories.length > 0 ? projectCategories : null)
          : undefined;

      updatedGoal = {
        ...currentGoals[existingIndex],
        ...(title !== undefined && { title }),
        ...(projectId !== undefined && { projectId }),
        ...(projectCategory !== undefined && { projectCategory }),
        ...(resolvedCategories !== undefined && {
          projectCategories: resolvedCategories,
          projectCategory: (resolvedCategories && resolvedCategories.length === 1) ? resolvedCategories[0] : (resolvedCategories ? null : projectCategory || null),
        }),
        ...(periodType !== undefined && { periodType }),
        ...(periodKey !== undefined && { periodKey }),
        ...(isRecurring !== undefined && { isRecurring: Boolean(isRecurring) }),
        ...(targetType !== undefined && { targetType }),
        ...(targetMinutes !== undefined && { targetMinutes: Number(targetMinutes) }),
        ...(targetCount !== undefined && { targetCount: targetCount ? Number(targetCount) : null }),
        ...(unit !== undefined && { unit }),
        ...(color !== undefined && { color }),
        updatedAt: now,
      };
      currentGoals[existingIndex] = updatedGoal;
    } else {
      const resolvedCategories: string[] | null = Array.isArray(projectCategories) && projectCategories.length > 0
        ? projectCategories
        : projectCategory
        ? [projectCategory]
        : null;

      updatedGoal = {
        id,
        userId,
        title: title || null,
        projectId: projectId || "",
        projectCategory: (resolvedCategories && resolvedCategories.length === 1) ? resolvedCategories[0] : (projectCategory || null),
        projectCategories: resolvedCategories,
        periodType: periodType || "week",
        periodKey: periodKey || null,
        isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : true,
        targetType: targetType || "duration",
        targetMinutes: Number(targetMinutes) || 60,
        targetCount: targetCount ? Number(targetCount) : null,
        unit: unit || null,
        color: color || null,
        createdAt: now,
        updatedAt: now,
      };
      currentGoals.unshift(updatedGoal);
    }

    await saveGoalsForUser(userId, currentGoals);

    return NextResponse.json({ success: true, goal: updatedGoal });
  } catch (err: any) {
    console.error("PUT /api/goals error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/goals?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing goal id" }, { status: 400 });
    }

    const currentGoals = await getGoalsForUser(userId);
    const filteredGoals = currentGoals.filter((g: any) => g.id !== id);
    await saveGoalsForUser(userId, filteredGoals);

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/goals error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
