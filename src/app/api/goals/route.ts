import { NextRequest, NextResponse } from "next/server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

async function getGoalsForUser(userId: string): Promise<any[]> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "GET",
      headers,
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
      headers,
    });
    let currentMetadata = {};
    if (getRes.ok) {
      const user = await getRes.json();
      currentMetadata = user?.user_metadata || {};
    }

    // 2. Update with new goals list
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers,
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

// GET /api/goals?userId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

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
      userId,
      title,
      projectId,
      projectCategory,
      periodType,
      periodKey,
      targetMinutes,
      color,
    } = body;

    if (!userId || !projectId || !targetMinutes) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const goalId = id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newGoal = {
      id: goalId,
      userId,
      title: title || null,
      projectId,
      projectCategory: projectCategory || null,
      periodType: periodType || "week",
      periodKey: periodKey || null,
      targetMinutes: Number(targetMinutes) || 60,
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
    const { id, userId, title, projectId, projectCategory, periodType, periodKey, targetMinutes, color } =
      body;

    if (!id || !userId) {
      return NextResponse.json({ success: false, error: "Missing goal id or userId" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const currentGoals = await getGoalsForUser(userId);
    const existingIndex = currentGoals.findIndex((g: any) => g.id === id);

    let updatedGoal: any = null;

    if (existingIndex >= 0) {
      updatedGoal = {
        ...currentGoals[existingIndex],
        ...(title !== undefined && { title }),
        ...(projectId !== undefined && { projectId }),
        ...(projectCategory !== undefined && { projectCategory }),
        ...(periodType !== undefined && { periodType }),
        ...(periodKey !== undefined && { periodKey }),
        ...(targetMinutes !== undefined && { targetMinutes: Number(targetMinutes) }),
        ...(color !== undefined && { color }),
        updatedAt: now,
      };
      currentGoals[existingIndex] = updatedGoal;
    } else {
      updatedGoal = {
        id,
        userId,
        title: title || null,
        projectId: projectId || "",
        projectCategory: projectCategory || null,
        periodType: periodType || "week",
        periodKey: periodKey || null,
        targetMinutes: Number(targetMinutes) || 60,
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

// DELETE /api/goals?id=xxx&userId=yyy
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!id || !userId) {
      return NextResponse.json({ success: false, error: "Missing goal id or userId" }, { status: 400 });
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
