import { NextRequest, NextResponse } from "next/server";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";
import { CalendarSubscription } from "@/features/calendar/types";
import { getAdminClient, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

async function mapRowToModel(row: any): Promise<CalendarSubscription> {
  let name = row.name;
  let url = row.url;
  let username = row.username;
  let password = row.password;

  try {
    if (name && isEncrypted(name)) name = await decryptText(name);
    if (url && isEncrypted(url)) url = await decryptText(url);
    if (username && isEncrypted(username)) username = await decryptText(username);
    if (password && isEncrypted(password)) password = await decryptText(password);
  } catch (e) {
    console.warn("Decryption error on calendar row:", e);
  }

  return {
    id: row.id,
    name: name || "Agenda",
    url: url || "",
    color: row.color || "#3B82F6",
    enabled: Boolean(row.enabled),
    username: username || null,
    password: password || null,
    lastSyncedAt: row.last_synced_at || undefined,
    error: row.error || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// GET /api/calendar/subscriptions
export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("calendar_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Supabase calendar_subscriptions GET query error:", error.message);
      return NextResponse.json({ subscriptions: [], error: error.message }, { status: 200 });
    }

    const subscriptions = await Promise.all((data || []).map(mapRowToModel));

    // Deduplicate by normalized URL
    const uniqueMap = new Map<string, CalendarSubscription>();
    for (const sub of subscriptions) {
      const norm = sub.url?.trim().toLowerCase();
      if (norm && !uniqueMap.has(norm)) {
        uniqueMap.set(norm, sub);
      }
    }

    return NextResponse.json({ subscriptions: Array.from(uniqueMap.values()) });
  } catch (err: any) {
    console.error("API /api/calendar/subscriptions GET error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/calendar/subscriptions
// Handles:
// 1. Single subscription creation: { subscription, userId }
// 2. Sync / Migration: { localSubscriptions, userId }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, localSubscriptions } = body;
    const targetUserId = await getRequestUserId(req);
    if (!targetUserId) return unauthorizedResponse();

    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    // 1. Sync Batch Mode
    if (Array.isArray(localSubscriptions) && localSubscriptions.length > 0) {
      const { data: existingRows } = await supabase
        .from("calendar_subscriptions")
        .select("id, url, name")
        .eq("user_id", targetUserId);

      const existingSubs = await Promise.all((existingRows || []).map(mapRowToModel));
      const existingUrls = new Set(existingSubs.map((s) => s.url?.trim().toLowerCase()));

      const inserted: CalendarSubscription[] = [];

      for (const item of localSubscriptions) {
        const normUrl = item.url?.trim().toLowerCase();
        if (!normUrl || existingUrls.has(normUrl)) continue;

        const subId = item.id || "cal-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
        const encryptedName = await encryptText(item.name || "Agenda");
        const encryptedUrl = await encryptText(item.url);
        const encryptedUsername = item.username ? await encryptText(item.username) : null;
        const encryptedPassword = item.password ? await encryptText(item.password) : null;

        const insertPayload: any = {
          id: subId,
          user_id: targetUserId,
          name: encryptedName,
          url: encryptedUrl,
          color: item.color || "#3B82F6",
          enabled: item.enabled !== undefined ? item.enabled : true,
          username: encryptedUsername,
          password: encryptedPassword,
          last_synced_at: item.lastSyncedAt || null,
          error: item.error || null,
          created_at: item.createdAt || nowIso,
          updated_at: nowIso,
        };

        const { data: createdRow, error: insertErr } = await supabase
          .from("calendar_subscriptions")
          .insert([insertPayload])
          .select()
          .single();

        if (!insertErr && createdRow) {
          const model = await mapRowToModel(createdRow);
          inserted.push(model);
          existingUrls.add(normUrl);
        }
      }

      const allMerged = [...existingSubs, ...inserted];
      return NextResponse.json({ success: true, count: allMerged.length, subscriptions: allMerged });
    }

    // 2. Single Creation Mode
    if (subscription) {
      const normUrl = subscription.url?.trim().toLowerCase();
      if (!normUrl) {
        return NextResponse.json({ error: "Missing subscription URL" }, { status: 400 });
      }

      let subId = subscription.id || "cal-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
      if (subscription.id) {
        // Never let an upsert by id take over another user's subscription row.
        const { data: sameId } = await supabase
          .from("calendar_subscriptions")
          .select("user_id")
          .eq("id", subscription.id)
          .maybeSingle();
        if (sameId && sameId.user_id !== targetUserId) {
          subId = "cal-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
        }
      }
      const encryptedName = await encryptText(subscription.name || "Agenda");
      const encryptedUrl = await encryptText(subscription.url);
      const encryptedUsername = subscription.username ? await encryptText(subscription.username) : null;
      const encryptedPassword = subscription.password ? await encryptText(subscription.password) : null;

      const insertPayload: any = {
        id: subId,
        user_id: targetUserId,
        name: encryptedName,
        url: encryptedUrl,
        color: subscription.color || "#3B82F6",
        enabled: subscription.enabled !== undefined ? subscription.enabled : true,
        username: encryptedUsername,
        password: encryptedPassword,
        last_synced_at: subscription.lastSyncedAt || null,
        error: subscription.error || null,
        created_at: subscription.createdAt || nowIso,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from("calendar_subscriptions")
        .upsert([insertPayload], { onConflict: "id" })
        .select()
        .single();

      if (error) {
        console.error("API /api/calendar/subscriptions POST insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const created = await mapRowToModel(data);
      return NextResponse.json({ success: true, subscription: created });
    }

    return NextResponse.json({ error: "No payload provided" }, { status: 400 });
  } catch (err: any) {
    console.error("API /api/calendar/subscriptions POST error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// PUT /api/calendar/subscriptions
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body;

    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    if (!id || !updates) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    const dbUpdates: any = {
      updated_at: nowIso,
    };

    if (updates.name !== undefined) {
      dbUpdates.name = await encryptText(updates.name);
    }
    if (updates.url !== undefined) {
      dbUpdates.url = await encryptText(updates.url);
    }
    if (updates.color !== undefined) {
      dbUpdates.color = updates.color;
    }
    if (updates.enabled !== undefined) {
      dbUpdates.enabled = updates.enabled;
    }
    if (updates.username !== undefined) {
      dbUpdates.username = updates.username ? await encryptText(updates.username) : null;
    }
    if (updates.password !== undefined) {
      dbUpdates.password = updates.password ? await encryptText(updates.password) : null;
    }
    if (updates.lastSyncedAt !== undefined) {
      dbUpdates.last_synced_at = updates.lastSyncedAt || null;
    }
    if (updates.error !== undefined) {
      dbUpdates.error = updates.error || null;
    }

    const { data, error } = await supabase
      .from("calendar_subscriptions")
      .update(dbUpdates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("API /api/calendar/subscriptions PUT error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updated = await mapRowToModel(data);
    return NextResponse.json({ success: true, subscription: updated });
  } catch (err: any) {
    console.error("API /api/calendar/subscriptions PUT error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/calendar/subscriptions?id=...
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
    const { error } = await supabase
      .from("calendar_subscriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("API /api/calendar/subscriptions DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API /api/calendar/subscriptions DELETE error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
