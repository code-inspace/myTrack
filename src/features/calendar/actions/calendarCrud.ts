import { CalendarSubscription } from "../types";
import { getStoredCalendarSubscriptions, saveStoredCalendarSubscriptions } from "./storage";
import { createClient } from "@/utils/supabase/client";
import { getEffectiveUserId } from "@/features/tasks/actions/user";
import { getStoredUserSession } from "@/features/auth/actions";
import { encryptText, decryptText, isEncrypted } from "@/lib/crypto/encryption";

export async function mapDbSubscriptionToModel(row: any): Promise<CalendarSubscription> {
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

async function resolveUserId(explicitUserId?: string): Promise<string> {
  const supabase = createClient();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch {}

  const stored = getStoredUserSession();
  if (stored?.id && stored.id !== "00000000-0000-0000-0000-000000000001") {
    return stored.id;
  }

  if (explicitUserId && explicitUserId !== "00000000-0000-0000-0000-000000000001") {
    return explicitUserId;
  }

  return getEffectiveUserId();
}

export async function fetchCalendarSubscriptions(userId?: string): Promise<CalendarSubscription[]> {
  const targetId = await resolveUserId(userId);
  const local = getStoredCalendarSubscriptions(targetId);

  try {
    // 1. If local cache contains subscriptions, automatically sync / push any missing to backend
    if (local.length > 0) {
      fetch("/api/calendar/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localSubscriptions: local, userId: targetId }),
      }).catch(() => {});
    }

    // 2. Fetch directly via Supabase client to avoid Serverless CPU usage
    const supabase = createClient();
    const { data: dbSubs, error } = await supabase
      .from("calendar_subscriptions")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(dbSubs)) {
      const remoteList: CalendarSubscription[] = await Promise.all(
        dbSubs.map((row) => mapDbSubscriptionToModel(row))
      );

      const mergedMap = new Map<string, CalendarSubscription>();
      for (const item of remoteList) {
        const norm = item.url?.trim().toLowerCase();
        if (norm) mergedMap.set(norm, item);
      }
      for (const item of local) {
        const norm = item.url?.trim().toLowerCase();
        if (norm && !mergedMap.has(norm)) {
          mergedMap.set(norm, item);
        }
      }

      const merged = Array.from(mergedMap.values());
      saveStoredCalendarSubscriptions(merged, targetId);
      return merged;
    }

    // 3. Fallback to API route
    const res = await fetch(`/api/calendar/subscriptions?userId=${encodeURIComponent(targetId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.subscriptions)) {
        const remoteList: CalendarSubscription[] = data.subscriptions;

        // Merge remote + any unsaved local
        const mergedMap = new Map<string, CalendarSubscription>();
        for (const item of remoteList) {
          const norm = item.url?.trim().toLowerCase();
          if (norm) mergedMap.set(norm, item);
        }
        for (const item of local) {
          const norm = item.url?.trim().toLowerCase();
          if (norm && !mergedMap.has(norm)) {
            mergedMap.set(norm, item);
          }
        }

        const merged = Array.from(mergedMap.values());
        saveStoredCalendarSubscriptions(merged, targetId);
        return merged;
      }
    }
  } catch (err) {
    console.warn("fetchCalendarSubscriptions error, falling back to storage:", err);
  }

  return local;
}

export async function createDbCalendarSubscription(
  sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt"> & { id?: string },
  userId?: string
): Promise<CalendarSubscription> {
  const targetId = await resolveUserId(userId);
  const nowIso = new Date().toISOString();
  const subId = sub.id || "cal-" + Date.now();
  const normUrl = sub.url?.trim().toLowerCase();

  // Optimistic local update
  const createdLocal: CalendarSubscription = {
    ...sub,
    id: subId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const current = getStoredCalendarSubscriptions(targetId);
  const updated = [...current.filter((s) => s.url?.trim().toLowerCase() !== normUrl), createdLocal];
  saveStoredCalendarSubscriptions(updated, targetId);

  // Persist to server API
  try {
    const res = await fetch("/api/calendar/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub, userId: targetId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.subscription) {
        const freshList = getStoredCalendarSubscriptions(targetId);
        const final = [...freshList.filter((s) => s.url?.trim().toLowerCase() !== normUrl), data.subscription];
        saveStoredCalendarSubscriptions(final, targetId);
        return data.subscription;
      }
    }
  } catch (err) {
    console.warn("API createDbCalendarSubscription error fallback:", err);
  }

  return createdLocal;
}

export async function updateDbCalendarSubscription(
  id: string,
  updates: Partial<CalendarSubscription>,
  userId?: string
): Promise<CalendarSubscription> {
  const targetId = await resolveUserId(userId);
  const currentList = getStoredCalendarSubscriptions(targetId);
  const existing = currentList.find((s) => s.id === id);
  const nowIso = new Date().toISOString();

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

  // Persist to server API
  try {
    const res = await fetch("/api/calendar/subscriptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, updates, userId: targetId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.subscription) {
        const freshList = getStoredCalendarSubscriptions(targetId);
        const final = freshList.map((s) => (s.id === id ? data.subscription : s));
        saveStoredCalendarSubscriptions(final, targetId);
        return data.subscription;
      }
    }
  } catch (err) {
    console.warn("API updateDbCalendarSubscription error:", err);
  }

  return updatedLocal;
}

export async function deleteDbCalendarSubscription(id: string, userId?: string): Promise<void> {
  const targetId = await resolveUserId(userId);

  // Optimistic local deletion
  const currentList = getStoredCalendarSubscriptions(targetId);
  const updated = currentList.filter((s) => s.id !== id);
  saveStoredCalendarSubscriptions(updated, targetId);

  // Persist to server API
  try {
    await fetch(`/api/calendar/subscriptions?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(targetId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("API deleteDbCalendarSubscription error:", err);
  }
}
