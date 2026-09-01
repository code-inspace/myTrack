import { NextRequest, NextResponse } from "next/server";
import { parseIcsContent } from "@/features/calendar/lib/parser";
import { CalendarSubscription, ExternalCalendarEvent } from "@/features/calendar/types";
import { parseISO, subDays, addDays } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Single Subscription Test Mode
    if (body.testSubscription) {
      const sub: CalendarSubscription = body.testSubscription;
      if (!sub.url?.trim()) {
        return NextResponse.json({ success: false, error: "URL manquante" }, { status: 400 });
      }

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

      if (sub.username && sub.password) {
        const authString = Buffer.from(`${sub.username.trim()}:${sub.password.trim()}`).toString("base64");
        headers["Authorization"] = `Basic ${authString}`;
      } else {
        try {
          const parsedUrl = new URL(fetchUrl);
          if (parsedUrl.username || parsedUrl.password) {
            const authString = Buffer.from(`${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`).toString("base64");
            headers["Authorization"] = `Basic ${authString}`;
            parsedUrl.username = "";
            parsedUrl.password = "";
            fetchUrl = parsedUrl.toString();
          }
        } catch {}
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(fetchUrl, {
          signal: controller.signal,
          headers,
          cache: "no-store",
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            return NextResponse.json({
              success: false,
              statusCode: res.status,
              error: `Erreur d'authentification (${res.status}). Renseignez un identifiant et mot de passe d'application CalDAV valides.`,
            });
          }
          if (res.status === 404) {
            return NextResponse.json({
              success: false,
              statusCode: res.status,
              error: "Agenda introuvable (404). Vérifiez l'URL de votre flux.",
            });
          }
          return NextResponse.json({
            success: false,
            statusCode: res.status,
            error: `Erreur serveur distant (${res.status} ${res.statusText}).`,
          });
        }

        const text = await res.text();
        if (!text.includes("BEGIN:VCALENDAR")) {
          const isHtml = text.toLowerCase().includes("<!doctype html") || text.toLowerCase().includes("<html");
          return NextResponse.json({
            success: false,
            error: isHtml
              ? "L'URL renvoie une page web HTML et non un flux d'agenda iCal (.ics). Assurez-vous d'avoir copié l'adresse secrète au format iCal (ex: .../basic.ics)."
              : "Le format de fichier reçu n'est pas un calendrier iCal valide (absence de balise BEGIN:VCALENDAR).",
            preview: text.slice(0, 150),
          });
        }

        const rangeStart = subDays(new Date(), 60);
        const rangeEnd = addDays(new Date(), 90);
        const parsed = parseIcsContent(
          text,
          sub.id || "test",
          sub.name || "Test",
          sub.color || "#3B82F6",
          rangeStart,
          rangeEnd
        );

        // Sort parsed events by date ascending
        const sorted = [...parsed].sort((a, b) => a.date.localeCompare(b.date));
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
          eventCount: parsed.length,
          sampleEvents,
          message: `Connexion réussie ! ${parsed.length} événement(s) détecté(s).`,
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          error: err?.name === "AbortError"
            ? "Délai de connexion dépassé (timeout de 12s)."
            : `Impossible de contacter le serveur : ${err?.message || err}`,
        });
      }
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
