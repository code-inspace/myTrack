"use client";

import { useEffect, useState } from "react";
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
import { getEffectiveUserId } from "@/features/tasks/actions/user";
import { subDays, addDays, parseISO, format } from "date-fns";

export interface CalendarSyncSummary {
  status: "idle" | "syncing" | "success" | "error";
  message: string;
  totalRetrieved: number;
  addedCount: number;
  activeCalendarsCount: number;
  syncedAt?: string;
  errors?: Record<string, string>;
}

export function useCalendarEvents(focusedDateStr?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || getEffectiveUserId() || "00000000-0000-0000-0000-000000000001";
  const [syncSummary, setSyncSummary] = useState<CalendarSyncSummary | null>(null);

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
    placeholderData: () => getStoredCalendarSubscriptions(userId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Calculate range around the selected date (+/- 30 days)
  const baseDate = focusedDateStr ? parseISO(focusedDateStr) : new Date();
  const rangeStart = format(subDays(baseDate, 30), "yyyy-MM-dd");
  const rangeEnd = format(addDays(baseDate, 45), "yyyy-MM-dd");

  const safeSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];
  const enabledSubs = safeSubscriptions.filter((s) => s && s.enabled && s.url?.trim());

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

  // Enhanced sync with additions/retrieval metrics
  const syncNow = async (): Promise<CalendarSyncSummary> => {
    setSyncSummary({
      status: "syncing",
      message: "Synchronisation des flux d'agenda en cours...",
      totalRetrieved: 0,
      addedCount: 0,
      activeCalendarsCount: enabledSubs.length,
    });

    if (enabledSubs.length === 0) {
      const summary: CalendarSyncSummary = {
        status: "idle",
        message: "Aucun calendrier externe actif à synchroniser. Activez un flux ci-dessous.",
        totalRetrieved: 0,
        addedCount: 0,
        activeCalendarsCount: 0,
        syncedAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setSyncSummary(summary);
      return summary;
    }

    const previousEventIds = new Set((queryResult?.events || []).map((e) => e.id));

    try {
      const result = await refetch();
      const newEvents = result.data?.events || [];
      const errors = result.data?.errors || {};
      const newAdded = newEvents.filter((e) => !previousEventIds.has(e.id)).length;
      const errorCount = Object.keys(errors).length;

      let msg = "";
      if (newAdded > 0) {
        msg = `Synchronisation réussie : ${newEvents.length} événement(s) récupéré(s) dont ${newAdded} nouveau(x) ajouté(s).`;
      } else if (newEvents.length > 0) {
        msg = `Agendas à jour : ${newEvents.length} événement(s) synchronisé(s), aucun nouvel événement.`;
      } else {
        msg = `Synchronisation terminée : 0 événement trouvé sur la période.`;
      }

      if (errorCount > 0) {
        msg += ` (${errorCount} flux en erreur sur ${enabledSubs.length})`;
      }

      const summary: CalendarSyncSummary = {
        status: errorCount === enabledSubs.length ? "error" : "success",
        message: msg,
        totalRetrieved: newEvents.length,
        addedCount: newAdded,
        activeCalendarsCount: enabledSubs.length,
        syncedAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        errors,
      };
      setSyncSummary(summary);
      return summary;
    } catch (err: any) {
      const summary: CalendarSyncSummary = {
        status: "error",
        message: `Erreur de synchronisation : ${err?.message || "Impossible de joindre le serveur"}`,
        totalRetrieved: 0,
        addedCount: 0,
        activeCalendarsCount: enabledSubs.length,
        syncedAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setSyncSummary(summary);
      return summary;
    }
  };

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
    const current = queryClient.getQueryData<CalendarSubscription[]>(["calendar-subscriptions", userId]) || safeSubscriptions;
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
    const current = queryClient.getQueryData<CalendarSubscription[]>(["calendar-subscriptions", userId]) || safeSubscriptions;
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
    const current = queryClient.getQueryData<CalendarSubscription[]>(["calendar-subscriptions", userId]) || safeSubscriptions;
    const updated = current.filter((s) => s.id !== id);
    queryClient.setQueryData(["calendar-subscriptions", userId], updated);
    saveStoredCalendarSubscriptions(updated, userId);

    deleteDbCalendarSubscription(id, userId).catch((err) =>
      console.warn("deleteDbCalendarSubscription bg fallback:", err)
    );
    queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
  };

  const toggleSubscription = (id: string) => {
    const target = safeSubscriptions.find((s) => s.id === id);
    if (!target) return;
    updateSubscription(id, { enabled: !target.enabled });
  };

  // Format event start/end times in user's local timezone
  const rawEvents = queryResult?.events || [];
  const localEvents: ExternalCalendarEvent[] = rawEvents.map((evt) => {
    if (evt.isAllDay) return evt;
    if (!evt.startIso) return evt;

    // Only convert pure UTC timestamps (ending with 'Z', e.g. Google Calendar)
    if (evt.startIso.endsWith("Z")) {
      try {
        const startDate = parseISO(evt.startIso);
        const endDate = evt.endIso && evt.endIso.endsWith("Z") ? parseISO(evt.endIso) : null;
        if (!isNaN(startDate.getTime())) {
          return {
            ...evt,
            date: format(startDate, "yyyy-MM-dd"),
            startTime: format(startDate, "HH:mm"),
            endTime: endDate && !isNaN(endDate.getTime()) ? format(endDate, "HH:mm") : evt.endTime,
          };
        }
      } catch {
        // Fallback to raw event on parse error
      }
    }

    // Local / Floating / TZID events (Zimbra, Beta.gouv, CalDAV) are already in exact local time
    return evt;
  });

  return {
    subscriptions: safeSubscriptions,
    events: localEvents,
    errors: queryResult?.errors || {},
    isLoading,
    isRefetching,
    refetch,
    syncNow,
    syncSummary,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    toggleSubscription,
  };
}
