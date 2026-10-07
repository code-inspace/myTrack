import { NextRequest, NextResponse } from "next/server";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";
import { getAdminClient, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

// GET /api/projects
export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const projects = await Promise.all(
      (data || []).map(async (row: any) => {
        let name = row.name;
        try {
          if (name && isEncrypted(name)) name = await decryptText(name);
        } catch {}

        return {
          id: row.id,
          userId: row.user_id,
          name,
          color: row.color || "#D4F63D",
          columns: Array.isArray(row.columns) ? row.columns : [],
          categories: Array.isArray(row.categories) ? row.categories : [],
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({ projects });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/projects
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, color = "#D4F63D", columns = [], categories = [] } = body;

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Missing project name" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const encryptedName = await encryptText(name.trim());

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          user_id: userId,
          name: encryptedName,
          color,
          columns,
          categories,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      project: {
        id: data.id,
        userId: data.user_id,
        name: name.trim(),
        color: data.color || color,
        columns: data.columns || columns,
        categories: data.categories || categories,
        createdAt: data.created_at || new Date().toISOString(),
        updatedAt: data.updated_at || new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/projects
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, color, columns, categories } = body;

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    if (!id) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      updates.name = await encryptText(name.trim());
    }
    if (color !== undefined) {
      updates.color = color;
    }
    if (columns !== undefined) {
      updates.columns = columns;
    }
    if (categories !== undefined) {
      updates.categories = categories;
    }

    const { error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/projects?id=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    if (!id) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
