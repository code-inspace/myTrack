"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { CalendarSubscription, ExternalCalendarEvent } from "../types";
import { getStoredCalendarSubscriptions, saveStoredCalendarSubscriptions } from "../actions/storage";
import {
  fetchCalendarSubscriptions,
  createDbCalendarSubscription,
  updateDbCalendarSubscription,
  deleteDbCalendarSubscription,
} from "../actions/calendarCrud";
import { createClient } from "@/utils/supabase/client";
import { subDays, addDays, parseISO, format } from "date-fns";

export function useCalendarEvents(focusedDateStr?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  // Supabase Realtime Listener for instant multi-device sync (Phone <-> Desktop)
  useEffect(() => {
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`realtime-calendars-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "calendar_subscriptions",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["calendar-subscriptions", userId] });
            queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Ignore if realtime fails
    }
  }, [userId, queryClient]);

  // 1. Calendar Subscriptions Query (from Encrypted Supabase DB + Local Cache)
  const { data: subscriptions = getStoredCalendarSubscriptions(userId) } = useQuery<CalendarSubscription[]>({
    queryKey: ["calendar-subscriptions", userId],
    queryFn: async () => {
      try {
        return await fetchCalendarSubscriptions(userId);
      } catch (err) {
        console.warn("fetchCalendarSubscriptions query fallback:", err);
        return getStoredCalendarSubscriptions(userId);
      }
    },
    initialData: () => getStoredCalendarSubscriptions(userId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Calculate range around the selected date (+/- 30 days)
  const baseDate = focusedDateStr ? parseISO(focusedDateStr) : new Date();
  const rangeStart = format(subDays(baseDate, 30), "yyyy-MM-dd");
  const rangeEnd = format(addDays(baseDate, 45), "yyyy-MM-dd");

  const enabledSubs = subscriptions.filter((s) => s.enabled && s.url?.trim());

  // 2. External Events Fetch Query
  const {
    data: queryResult = { events: [], errors: {} },
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<{ events: ExternalCalendarEvent[]; errors: Record<string, string> }>({
    queryKey: [
      "external-calendar-events",
      userId,
      enabledSubs.map((s) => `${s.id}-${s.url}-${s.color}`).join(";"),
      rangeStart,
      rangeEnd,
    ],
    queryFn: async () => {
      if (!enabledSubs.length) {
        return { events: [], errors: {} };
      }

      try {
        const res = await fetch("/api/calendar/ics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptions: enabledSubs,
            rangeStart,
            rangeEnd,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch external calendars");
        }

        return await res.json();
      } catch (err) {
        console.warn("External calendar fetch failed:", err);
        return { events: [], errors: {} };
      }
    },
    enabled: enabledSubs.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // --- Subscriptions Local-First & Optimistic Mutations ---
  const addSubscription = (
    sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt">
  ): CalendarSubscription => {
    const nowIso = new Date().toISOString();
    const newRecord: CalendarSubscription = {
      ...sub,
      id: "cal-" + Date.now(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const current = queryClient.getQueryData<CalendarSubscription[]>(["calendar-subscriptions", userId]) || subscriptions;
    const updated = [...current.filter((s) => s.id !== newRecord.id), newRecord];
    queryClient.setQueryData(["calendar-subscriptions", userId], updated);
    saveStoredCalendarSubscriptions(updated, userId);

    createDbCalendarSubscription(newRecord, userId).catch((err) =>
      console.warn("createDbCalendarSubscription bg fallback:", err)
    );
    queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
    return newRecord;
  };

  const updateSubscription = (
    id: string,
    updates: Partial<CalendarSubscription>
  ) => {
    const current = queryClient.getQueryData<CalendarSubscription[]>(["calendar-subscriptions", userId]) || subscriptions;
    const updated = current.map((s) =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    );
    queryClient.setQueryData(["calendar-subscriptions", userId], updated);
    saveStoredCalendarSubscriptions(updated, userId);

    updateDbCalendarSubscription(id, updates, userId).catch((err) =>
      console.warn("updateDbCalendarSubscription bg fallback:", err)
    );
    queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
  };

  const deleteSubscription = (id: string) => {
    const current = queryClient.getQueryData<CalendarSubscription[]>(["calendar-subscriptions", userId]) || subscriptions;
    const updated = current.filter((s) => s.id !== id);
    queryClient.setQueryData(["calendar-subscriptions", userId], updated);
    saveStoredCalendarSubscriptions(updated, userId);

    deleteDbCalendarSubscription(id, userId).catch((err) =>
      console.warn("deleteDbCalendarSubscription bg fallback:", err)
    );
    queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
  };

  const toggleSubscription = (id: string) => {
    const target = subscriptions.find((s) => s.id === id);
    if (!target) return;
    updateSubscription(id, { enabled: !target.enabled });
  };

  return {
    subscriptions,
    events: queryResult.events || [],
    errors: queryResult.errors || {},
    isLoading,
    isRefetching,
    refetch,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    toggleSubscription,
  };
}
