import { CalendarSubscription } from "../types";
import { getStoredCalendarSubscriptions, saveStoredCalendarSubscriptions } from "./storage";
import { createClient } from "@/utils/supabase/client";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";
import { getEffectiveUserId } from "@/features/tasks/actions/user";

export async function mapDbSubscriptionToModel(row: any): Promise<CalendarSubscription> {
  let name = row.name;
  let url = row.url;
  let username = row.username;
  let password = row.password;

  if (name && isEncrypted(name)) {
    name = await decryptText(name);
  }
  if (url && isEncrypted(url)) {
    url = await decryptText(url);
  }
  if (username && isEncrypted(username)) {
    username = await decryptText(username);
  }
  if (password && isEncrypted(password)) {
    password = await decryptText(password);
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

async function resolveUserId(explicitUserId?: string): Promise<string> {
  if (explicitUserId) return explicitUserId;
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id || getEffectiveUserId();
}

export async function fetchCalendarSubscriptions(userId?: string): Promise<CalendarSubscription[]> {
  const supabase = createClient();
  const targetId = await resolveUserId(userId);

  try {
    const { data, error } = await supabase
      .from("calendar_subscriptions")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      const mapped = await Promise.all(data.map(mapDbSubscriptionToModel));
      const local = getStoredCalendarSubscriptions(targetId);
      const dbIds = new Set(data.map((d: any) => d.id));

      // Auto-migrate: If there are agendas stored locally on the phone that are not yet in Supabase,
      // encrypt and save them to Supabase automatically so the user never has to retype them!
      const missingInDb = local.filter((s) => !dbIds.has(s.id) && s.url?.trim());
      if (missingInDb.length > 0) {
        Promise.all(
          missingInDb.map((sub) =>
            createDbCalendarSubscription(sub, targetId).catch((err) =>
              console.warn("Auto-sync existing calendar error:", err)
            )
          )
        ).catch(() => {});
      }

      const subMap = new Map<string, CalendarSubscription>();
      for (const s of local) {
        subMap.set(s.id, s);
      }
      for (const s of mapped) {
        subMap.set(s.id, s);
      }
      const merged = Array.from(subMap.values());
      saveStoredCalendarSubscriptions(merged, targetId);
      return merged;
    }
  } catch (err) {
    console.warn("Supabase fetchCalendarSubscriptions error:", err);
  }

  return getStoredCalendarSubscriptions(targetId);
}

export async function createDbCalendarSubscription(
  sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt">,
  userId?: string
): Promise<CalendarSubscription> {
  const supabase = createClient();
  const targetId = await resolveUserId(userId);

  const nowIso = new Date().toISOString();
  const subId = "cal-" + Date.now();

  const encryptedName = await encryptText(sub.name);
  const encryptedUrl = await encryptText(sub.url);
  const encryptedUsername = sub.username ? await encryptText(sub.username) : null;
  const encryptedPassword = sub.password ? await encryptText(sub.password) : null;

  const insertPayload = {
    id: subId,
    user_id: targetId,
    name: encryptedName,
    url: encryptedUrl,
    color: sub.color || "#3B82F6",
    enabled: sub.enabled !== undefined ? sub.enabled : true,
    username: encryptedUsername,
    password: encryptedPassword,
    last_synced_at: sub.lastSyncedAt || null,
    error: sub.error || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    const { data, error } = await supabase
      .from("calendar_subscriptions")
      .insert([insertPayload])
      .select()
      .single();

    if (!error && data) {
      const created = await mapDbSubscriptionToModel(data);
      const current = getStoredCalendarSubscriptions(targetId);
      const updated = [...current.filter((s) => s.id !== created.id), created];
      saveStoredCalendarSubscriptions(updated, targetId);
      return created;
    }
    if (error) {
      console.warn("Supabase createDbCalendarSubscription fallback:", error);
    }
  } catch (err) {
    console.warn("Supabase createDbCalendarSubscription exception fallback:", err);
  }

  // Local fallback
  const createdLocal: CalendarSubscription = {
    ...sub,
    id: subId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const current = getStoredCalendarSubscriptions(targetId);
  const updated = [...current.filter((s) => s.id !== createdLocal.id), createdLocal];
  saveStoredCalendarSubscriptions(updated, targetId);
  return createdLocal;
}

export async function updateDbCalendarSubscription(
  id: string,
  updates: Partial<CalendarSubscription>,
  userId?: string
): Promise<CalendarSubscription> {
  const supabase = createClient();
  const targetId = await resolveUserId(userId);

  const currentList = getStoredCalendarSubscriptions(targetId);
  const existing = currentList.find((s) => s.id === id);
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

  try {
    const { data, error } = await supabase
      .from("calendar_subscriptions")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const updated = await mapDbSubscriptionToModel(data);
      const nextList = currentList.map((s) => (s.id === id ? updated : s));
      saveStoredCalendarSubscriptions(nextList, targetId);
      return updated;
    }
  } catch (err) {
    console.warn("Supabase updateDbCalendarSubscription error:", err);
  }

  // Local fallback
  const updatedLocal: CalendarSubscription = {
    ...(existing || {
      id,
      name: "Agenda",
      url: "",
      color: "#3B82F6",
      enabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
    ...updates,
    updatedAt: nowIso,
  };
  const nextList = currentList.map((s) => (s.id === id ? updatedLocal : s));
  saveStoredCalendarSubscriptions(nextList, targetId);
  return updatedLocal;
}

export async function deleteDbCalendarSubscription(id: string, userId?: string): Promise<void> {
  const supabase = createClient();
  const targetId = await resolveUserId(userId);

  try {
    await supabase.from("calendar_subscriptions").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase deleteDbCalendarSubscription error:", err);
  }

  const currentList = getStoredCalendarSubscriptions(targetId);
  const updated = currentList.filter((s) => s.id !== id);
  saveStoredCalendarSubscriptions(updated, targetId);
}
