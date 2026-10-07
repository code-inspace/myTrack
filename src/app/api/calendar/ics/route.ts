import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { CalendarSubscription, ExternalCalendarEvent } from "@/features/calendar/types";
import { fetchCalDavOrIcs } from "@/features/calendar/lib/caldavClient";
import { parseISO, subDays, addDays } from "date-fns";

interface CachedCalendarFeed {
  events: ExternalCalendarEvent[];
  timestamp: number;
}
const icsCache = new Map<string, CachedCalendarFeed>();
const ICS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    const body = await req.json();

    // 1. Single Subscription Test Mode
    if (body.testSubscription) {
      const sub: CalendarSubscription = body.testSubscription;
      if (!sub.url?.trim()) {
        return NextResponse.json({ success: false, error: "URL manquante" }, { status: 400 });
      }

      const rangeStart = subDays(new Date(), 60);
      const rangeEnd = addDays(new Date(), 90);

      const result = await fetchCalDavOrIcs(sub, rangeStart, rangeEnd);

      if (!result.success || !result.events) {
        return NextResponse.json({
          success: false,
          statusCode: result.statusCode,
          error: result.error || "Impossible de récupérer les événements du calendrier",
          preview: result.preview,
        });
      }

      // Sort parsed events by date ascending
      const sorted = [...result.events].sort((a, b) => a.date.localeCompare(b.date));
      const sampleEvents = sorted.slice(0, 5).map((e) => ({
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        isAllDay: e.isAllDay,
        location: e.location,
      }));

      return NextResponse.json({
        success: true,
        eventCount: result.events.length,
        sampleEvents,
        message: `Connexion réussie ! ${result.events.length} événement(s) détecté(s).`,
      });
    }

    // 2. Standard Batch Fetch Mode
    const subscriptions: CalendarSubscription[] = body.subscriptions || [];
    const rangeStartStr: string = body.rangeStart;
    const rangeEndStr: string = body.rangeEnd;

    if (!subscriptions.length) {
      return NextResponse.json({ events: [], errors: {} });
    }

    const rangeStart = rangeStartStr ? parseISO(rangeStartStr) : subDays(new Date(), 30);
    const rangeEnd = rangeEndStr ? parseISO(rangeEndStr) : addDays(new Date(), 60);

    const allEvents: ExternalCalendarEvent[] = [];
    const errors: Record<string, string> = {};
    const now = Date.now();

    await Promise.all(
      subscriptions.map(async (sub) => {
        if (!sub.enabled || !sub.url) return;

        const cacheKey = `${sub.url.trim()}__${sub.color || ""}__${sub.name || ""}__${rangeStartStr || ""}__${rangeEndStr || ""}`;
        const cached = icsCache.get(cacheKey);

        if (cached && now - cached.timestamp < ICS_CACHE_TTL_MS) {
          allEvents.push(...cached.events);
          return;
        }

        try {
          const result = await fetchCalDavOrIcs(sub, rangeStart, rangeEnd);
          if (result.success && result.events) {
            icsCache.set(cacheKey, { events: result.events, timestamp: now });
            allEvents.push(...result.events);
          } else {
            errors[sub.id] = result.error || "Erreur de connexion au calendrier";
          }
        } catch (err: any) {
          console.warn(`Failed to fetch iCal/CalDAV feed for ${sub.name}:`, err?.message || err);
          errors[sub.id] = err?.name === "AbortError" ? "Délai de connexion dépassé (timeout)" : "Impossible de charger le flux iCal / CalDAV";
        }
      })
    );

    return NextResponse.json(
      { events: allEvents, errors },
      {
        headers: {
          "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
