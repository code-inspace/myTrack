import { NextRequest, NextResponse } from "next/server";
import { parseIcsContent } from "@/features/calendar/lib/parser";
import { CalendarSubscription, ExternalCalendarEvent } from "@/features/calendar/types";
import { parseISO, subDays, addDays } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    await Promise.all(
      subscriptions.map(async (sub) => {
        if (!sub.enabled || !sub.url) return;

        let fetchUrl = sub.url.trim();
        if (fetchUrl.startsWith("webcal://")) {
          fetchUrl = "https://" + fetchUrl.slice(9);
        } else if (fetchUrl.startsWith("http://")) {
          fetchUrl = "https://" + fetchUrl.slice(7);
        }

        // Auto-handle Nextcloud/ownCloud/SOGo CalDAV collection URLs
        if (
          (fetchUrl.includes("/dav/calendars/") || fetchUrl.includes("/caldav/")) &&
          !fetchUrl.endsWith(".ics") &&
          !fetchUrl.includes("?export") &&
          !fetchUrl.includes("&export")
        ) {
          fetchUrl = fetchUrl.replace(/\/+$/, "") + "?export";
        }

        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (compatible; MyTrackCalendar/1.0; +https://mytrack.app)",
          Accept: "text/calendar, text/plain, */*",
        };

        // Handle explicit username & app password
        if (sub.username && sub.password) {
          const authString = Buffer.from(`${sub.username.trim()}:${sub.password.trim()}`).toString("base64");
          headers["Authorization"] = `Basic ${authString}`;
        } else {
          // Check for credentials embedded in URL (e.g. https://user:pass@host/...)
          try {
            const parsedUrl = new URL(fetchUrl);
            if (parsedUrl.username || parsedUrl.password) {
              const authString = Buffer.from(`${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`).toString("base64");
              headers["Authorization"] = `Basic ${authString}`;
              parsedUrl.username = "";
              parsedUrl.password = "";
              fetchUrl = parsedUrl.toString();
            }
          } catch {
            // ignore URL parse error
          }
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

          const res = await fetch(fetchUrl, {
            signal: controller.signal,
            headers,
            next: { revalidate: 300 }, // 5 min Next.js fetch cache
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              errors[sub.id] = "Authentification requise (vérifiez votre identifiant et mot de passe d'application CalDAV).";
            } else {
              errors[sub.id] = `Erreur HTTP ${res.status}: ${res.statusText}`;
            }
            return;
          }

          const icsText = await res.text();
          const parsed = parseIcsContent(
            icsText,
            sub.id,
            sub.name,
            sub.color || "#3B82F6",
            rangeStart,
            rangeEnd
          );

          allEvents.push(...parsed);
        } catch (err: any) {
          console.warn(`Failed to fetch iCal feed for ${sub.name}:`, err?.message || err);
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
