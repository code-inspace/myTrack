"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { CalendarSubscription, ExternalCalendarEvent } from "../types";
import {
  getStoredCalendarSubscriptions,
  saveStoredCalendarSubscriptions,
} from "../actions/storage";
import { subDays, addDays, parseISO, format } from "date-fns";

export function useCalendarEvents(focusedDateStr?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  // 1. Calendar Subscriptions Query
  const { data: subscriptions = [] } = useQuery<CalendarSubscription[]>({
    queryKey: ["calendar-subscriptions", userId],
    queryFn: () => getStoredCalendarSubscriptions(userId),
    initialData: () => getStoredCalendarSubscriptions(userId),
    staleTime: Infinity,
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

      return res.json();
    },
    enabled: enabledSubs.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // --- Subscriptions Mutations ---
  const saveSubscriptions = (newSubs: CalendarSubscription[]) => {
    saveStoredCalendarSubscriptions(newSubs, userId);
    queryClient.setQueryData(["calendar-subscriptions", userId], newSubs);
    queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
  };

  const addSubscription = (
    sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt">
  ) => {
    const nowIso = new Date().toISOString();
    const newRecord: CalendarSubscription = {
      ...sub,
      id: "cal-" + Date.now(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const updated = [...subscriptions, newRecord];
    saveSubscriptions(updated);
    return newRecord;
  };

  const updateSubscription = (
    id: string,
    updates: Partial<CalendarSubscription>
  ) => {
    const updated = subscriptions.map((s) =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    );
    saveSubscriptions(updated);
  };

  const deleteSubscription = (id: string) => {
    const updated = subscriptions.filter((s) => s.id !== id);
    saveSubscriptions(updated);
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
