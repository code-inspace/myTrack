"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { CalendarSubscription, ExternalCalendarEvent } from "../types";
import { getStoredCalendarSubscriptions } from "../actions/storage";
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
  }, [userId, queryClient]);

  // 1. Calendar Subscriptions Query (from Encrypted Supabase DB + Local Cache)
  const { data: subscriptions = getStoredCalendarSubscriptions(userId) } = useQuery<CalendarSubscription[]>({
    queryKey: ["calendar-subscriptions", userId],
    queryFn: async () => fetchCalendarSubscriptions(userId),
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
  const addSubscriptionMutation = useMutation({
    mutationFn: async (sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt">) => {
      return createDbCalendarSubscription(sub, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-subscriptions", userId] });
      queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CalendarSubscription> }) => {
      return updateDbCalendarSubscription(id, updates, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-subscriptions", userId] });
      queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
    },
  });

  const deleteSubscriptionMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteDbCalendarSubscription(id, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-subscriptions", userId] });
      queryClient.invalidateQueries({ queryKey: ["external-calendar-events"] });
    },
  });

  const addSubscription = (
    sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt">
  ) => {
    return addSubscriptionMutation.mutate(sub);
  };

  const updateSubscription = (
    id: string,
    updates: Partial<CalendarSubscription>
  ) => {
    updateSubscriptionMutation.mutate({ id, updates });
  };

  const deleteSubscription = (id: string) => {
    deleteSubscriptionMutation.mutate(id);
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
