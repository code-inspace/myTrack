import { CalendarSubscription, ExternalCalendarEvent } from "../types";
import { parseIcsContent } from "./parser";
import { format, subDays, addDays } from "date-fns";

export interface CalDavFetchResult {
  success: boolean;
  icsContent?: string;
  events?: ExternalCalendarEvent[];
  error?: string;
  statusCode?: number;
  preview?: string;
  workingUrl?: string;
}

// In-memory working URL cache for fast-path retrieval (persists across API requests in server runtime)
const workingUrlCache = new Map<string, string>();

function unescapeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function extractCalendarDataFromXml(xmlText: string): string[] {
  const calendarDataRegex = /<(?:\w+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:\w+:)?calendar-data>/gi;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = calendarDataRegex.exec(xmlText)) !== null) {
    if (match[1]) {
      const clean = unescapeXmlEntities(match[1].trim());
      if (clean.includes("BEGIN:VCALENDAR") || clean.includes("BEGIN:VEVENT")) {
        matches.push(clean);
      }
    }
  }

  return matches;
}

function buildBasicAuthHeader(username?: string | null, password?: string | null): string | null {
  if (!username || !password) return null;
  const credentials = `${username.trim()}:${password.trim()}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export function generateCandidateUrls(rawUrl: string, username?: string | null): string[] {
  let base = rawUrl.trim();
  if (base.startsWith("webcal://")) {
    base = "https://" + base.slice(9);
  } else if (base.startsWith("http://")) {
    base = "https://" + base.slice(7);
  }

  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (url: string) => {
    const clean = url.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      candidates.push(clean);
    }
  };

  // 1. Exact URL as entered
  addCandidate(base);

  // 2. If it already has .ics or ?export or ?fmt=ics, try variants
  if (base.endsWith(".ics")) {
    addCandidate(base);
  } else {
    // CalDAV collection URL auto-export params
    if (!base.includes("?")) {
      addCandidate(`${base}?export`);
      addCandidate(`${base}?fmt=ics`);
      addCandidate(`${base}.ics`);
    }
  }

  try {
    const parsed = new URL(base);
    const host = parsed.host;
    const origin = parsed.origin;
    const cleanUser = username?.trim() || "";
    const userWithoutDomain = cleanUser.includes("@") ? cleanUser.split("@")[0] : cleanUser;

    // 3. Zimbra / French State Messagerie Numérique Gouv Candidates
    // (e.g. messagerie.numerique.gouv.fr, zimbra.*, etc.)
    if (cleanUser) {
      // Direct Zimbra REST export URLs
      addCandidate(`${origin}/home/${encodeURIComponent(cleanUser)}/Calendar.ics`);
      addCandidate(`${origin}/home/${encodeURIComponent(cleanUser)}/Calendrier.ics`);
      addCandidate(`${origin}/home/${encodeURIComponent(cleanUser)}/Calendar?fmt=ics`);
      addCandidate(`${origin}/home/${encodeURIComponent(cleanUser)}/Calendrier?fmt=ics`);
      addCandidate(`${origin}/dav/${encodeURIComponent(cleanUser)}/Calendar?fmt=ics`);
      addCandidate(`${origin}/dav/${encodeURIComponent(cleanUser)}/Calendrier?fmt=ics`);
      addCandidate(`${origin}/service/home/~/${encodeURIComponent(cleanUser)}/Calendar.ics`);
      addCandidate(`${origin}/service/home/~/${encodeURIComponent(cleanUser)}/Calendrier.ics`);

      if (userWithoutDomain && userWithoutDomain !== cleanUser) {
        addCandidate(`${origin}/home/${encodeURIComponent(userWithoutDomain)}/Calendar.ics`);
        addCandidate(`${origin}/home/${encodeURIComponent(userWithoutDomain)}/Calendrier.ics`);
        addCandidate(`${origin}/home/${encodeURIComponent(userWithoutDomain)}/Calendar?fmt=ics`);
        addCandidate(`${origin}/home/${encodeURIComponent(userWithoutDomain)}/Calendrier?fmt=ics`);
        addCandidate(`${origin}/dav/${encodeURIComponent(userWithoutDomain)}/Calendar?fmt=ics`);
        addCandidate(`${origin}/dav/${encodeURIComponent(userWithoutDomain)}/Calendrier?fmt=ics`);
      }

      // 4. Nextcloud / ownCloud / SOGo Candidates
      addCandidate(`${origin}/remote.php/dav/calendars/${encodeURIComponent(cleanUser)}/personal?export`);
      addCandidate(`${origin}/remote.php/dav/calendars/${encodeURIComponent(cleanUser)}/personal.ics`);
      addCandidate(`${origin}/SOGo/dav/${encodeURIComponent(cleanUser)}/Calendar/personal.ics`);
      addCandidate(`${origin}/SOGo/dav/${encodeURIComponent(cleanUser)}/Calendar/personal?export`);
    }

    // 5. If path is a folder (e.g. /dav/... or /caldav/...)
    if (parsed.pathname && parsed.pathname !== "/") {
      const trimmedPath = parsed.pathname.replace(/\/+$/, "");
      addCandidate(`${origin}${trimmedPath}?export`);
      addCandidate(`${origin}${trimmedPath}?fmt=ics`);
      addCandidate(`${origin}${trimmedPath}.ics`);
      addCandidate(`${origin}${trimmedPath}/Calendar.ics`);
      addCandidate(`${origin}${trimmedPath}/Calendrier.ics`);
    }
  } catch {}

  return candidates;
}

async function tryGetCandidate(
  candidateUrl: string,
  baseHeaders: Record<string, string>,
  subscription: CalendarSubscription,
  rangeStart: Date,
  rangeEnd: Date,
  timeoutMs = 3500
): Promise<CalDavFetchResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(candidateUrl, {
      method: "GET",
      headers: baseHeaders,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const text = await res.text();

    // Check if direct valid iCalendar
    if (text.includes("BEGIN:VCALENDAR")) {
      const events = parseIcsContent(
        text,
        subscription.id || "sub",
        subscription.name || "Agenda",
        subscription.color || "#3B82F6",
        rangeStart,
        rangeEnd
      );

      return {
        success: true,
        icsContent: text,
        events,
        statusCode: res.status,
        workingUrl: candidateUrl,
      };
    }

    // Check if Multi-Status XML containing calendar-data
    if (text.includes("calendar-data") || text.includes("<multistatus") || text.includes("<d:multistatus")) {
      const extracted = extractCalendarDataFromXml(text);
      if (extracted.length > 0) {
        const combinedIcs = extracted.join("\n");
        const events = parseIcsContent(
          combinedIcs,
          subscription.id || "sub",
          subscription.name || "Agenda",
          subscription.color || "#3B82F6",
          rangeStart,
          rangeEnd
        );

        return {
          success: true,
          icsContent: combinedIcs,
          events,
          statusCode: res.status,
          workingUrl: candidateUrl,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchCalDavOrIcs(
  subscription: CalendarSubscription,
  rangeStart: Date = subDays(new Date(), 60),
  rangeEnd: Date = addDays(new Date(), 90)
): Promise<CalDavFetchResult> {
  const url = subscription.url?.trim();
  if (!url) {
    return { success: false, error: "URL manquante" };
  }

  const cacheKey = subscription.id || url;
  const authHeader = buildBasicAuthHeader(subscription.username, subscription.password);

  const baseHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 MyTrack/1.0",
    Accept: "text/calendar, text/x-vcalendar, text/plain, application/xml, text/xml, */*",
  };

  if (authHeader) {
    baseHeaders["Authorization"] = authHeader;
  }

  let lastStatus: number | undefined;
  let lastError = "Impossible de récupérer les événements de l'agenda.";
  let lastHtmlPreview: string | undefined;

  // 1. FAST PATH: Check previously working URL from in-memory cache or subscription
  const cachedUrl = workingUrlCache.get(cacheKey);
  if (cachedUrl) {
    const fastResult = await tryGetCandidate(
      cachedUrl,
      baseHeaders,
      subscription,
      rangeStart,
      rangeEnd,
      3500
    );
    if (fastResult && fastResult.success) {
      return fastResult;
    }
  }

  // 2. PARALLEL CANDIDATE PROBES (batches of 4 candidates with 3.5s timeout)
  const candidates = generateCandidateUrls(url, subscription.username);

  // Put cached URL at top if exists
  if (cachedUrl && !candidates.includes(cachedUrl)) {
    candidates.unshift(cachedUrl);
  }

  // Run candidate probes in parallel chunks of 4
  const chunkSize = 4;
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    const probePromises = chunk.map((cand) =>
      tryGetCandidate(cand, baseHeaders, subscription, rangeStart, rangeEnd, 3500)
    );

    const results = await Promise.all(probePromises);
    const successful = results.find((r) => r !== null && r.success && r.events);
    if (successful) {
      if (successful.workingUrl) {
        workingUrlCache.set(cacheKey, successful.workingUrl);
      }
      return successful;
    }
  }

  // Phase 2: If standard GET gave HTML, try CalDAV REPORT (RFC 4791)
  const rangeStartCalDav = format(rangeStart, "yyyyMMdd'T'HHmmss'Z'");
  const rangeEndCalDav = format(rangeEnd, "yyyyMMdd'T'HHmmss'Z'");

  const reportXmlBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${rangeStartCalDav}" end="${rangeEndCalDav}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  for (const candidateUrl of candidates.slice(0, 6)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(candidateUrl, {
        method: "REPORT",
        headers: {
          ...baseHeaders,
          "Content-Type": "application/xml; charset=utf-8",
          Depth: "1",
        },
        body: reportXmlBody,
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text.includes("BEGIN:VCALENDAR")) {
          const events = parseIcsContent(
            text,
            subscription.id || "sub",
            subscription.name || "Agenda",
            subscription.color || "#3B82F6",
            rangeStart,
            rangeEnd
          );
          return {
            success: true,
            icsContent: text,
            events,
            statusCode: res.status,
          };
        }

        const extracted = extractCalendarDataFromXml(text);
        if (extracted.length > 0) {
          const combinedIcs = extracted.join("\n");
          const events = parseIcsContent(
            combinedIcs,
            subscription.id || "sub",
            subscription.name || "Agenda",
            subscription.color || "#3B82F6",
            rangeStart,
            rangeEnd
          );
          return {
            success: true,
            icsContent: combinedIcs,
            events,
            statusCode: res.status,
          };
        }
      }
    } catch {}
  }

  // Phase 3: CalDAV PROPFIND Discovery (RFC 4918)
  const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>`;

  try {
    const parsedUrl = new URL(candidates[0]);
    const origin = parsedUrl.origin;
    const cleanUser = subscription.username?.trim() || "";

    const discoveryEndpoints = [
      `${origin}/.well-known/caldav`,
      `${origin}/dav/`,
      `${origin}/principals/`,
      `${origin}/caldav/`,
    ];
    if (cleanUser) {
      discoveryEndpoints.push(`${origin}/dav/${encodeURIComponent(cleanUser)}/`);
      discoveryEndpoints.push(`${origin}/principals/users/${encodeURIComponent(cleanUser)}/`);
    }

    for (const endpoint of discoveryEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(endpoint, {
          method: "PROPFIND",
          headers: {
            ...baseHeaders,
            "Content-Type": "application/xml; charset=utf-8",
            Depth: "1",
          },
          body: propfindXml,
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const xml = await res.text();
          // Look for calendar hrefs inside response
          const hrefMatches = xml.match(/<(?:\w+:)?href[^>]*>([^<]+)<\/(?:\w+:)?href>/gi);
          if (hrefMatches) {
            for (const hMatch of hrefMatches) {
              const rawHref = hMatch.replace(/<\/?(?:\w+:)?href[^>]*>/gi, "").trim();
              if (rawHref && (rawHref.includes("calendar") || rawHref.includes("dav") || rawHref.includes("home"))) {
                const targetUrl = rawHref.startsWith("http") ? rawHref : `${origin}${rawHref.startsWith("/") ? "" : "/"}${rawHref}`;
                // Try to query this discovered calendar
                const reportRes = await fetch(targetUrl, {
                  method: "REPORT",
                  headers: {
                    ...baseHeaders,
                    "Content-Type": "application/xml; charset=utf-8",
                    Depth: "1",
                  },
                  body: reportXmlBody,
                });
                if (reportRes.ok) {
                  const repText = await reportRes.text();
                  const extracted = extractCalendarDataFromXml(repText);
                  if (extracted.length > 0) {
                    const combined = extracted.join("\n");
                    const events = parseIcsContent(
                      combined,
                      subscription.id || "sub",
                      subscription.name || "Agenda",
                      subscription.color || "#3B82F6",
                      rangeStart,
                      rangeEnd
                    );
                    return {
                      success: true,
                      icsContent: combined,
                      events,
                      statusCode: 200,
                    };
                  }
                }
              }
            }
          }
        }
      } catch {}
    }
  } catch {}

  // If all failed, return helpful error explanation
  if (lastHtmlPreview) {
    return {
      success: false,
      statusCode: lastStatus,
      error: `Le serveur distant renvoie une page de connexion web (HTML) au lieu du flux CalDAV/iCal. Assurez-vous d'avoir saisi votre adresse email complète (ex: prenom.nom@beta.gouv.fr) et votre mot de passe d'application dans la section « + Authentification CalDAV ».`,
      preview: lastHtmlPreview,
    };
  }

  return {
    success: false,
    statusCode: lastStatus,
    error: lastError,
  };
}
