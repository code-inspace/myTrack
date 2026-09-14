import { ExternalCalendarEvent } from "../types";
import { format, parseISO, addDays, addWeeks, addMonths, addYears, isBefore, isAfter, isSameDay } from "date-fns";

interface RawVEvent {
  summary?: string;
  description?: string;
  location?: string;
  dtstart?: string;
  dtstartParams?: Record<string, string>;
  dtend?: string;
  dtendParams?: Record<string, string>;
  duration?: string;
  rrule?: string;
  uid?: string;
  status?: string;
}

// Unfold RFC 5545 lines (lines starting with space or tab continue previous line)
function unfoldIcsLines(rawIcs: string): string[] {
  const normalized = rawIcs.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const unfolded: string[] = [];

  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfolded.length > 0) {
        unfolded[unfolded.length - 1] += line.slice(1);
      }
    } else {
      unfolded.push(line);
    }
  }

  return unfolded;
}

export function unescapeIcsText(text: string): string {
  if (!text) return "";
  let clean = text
    .replace(/\\n/gi, "\n")
    .replace(/\\r/gi, "")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

  // Decode common HTML entities (from Zimbra/Nextcloud/Google HTML-embedded descriptions)
  clean = clean
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#34;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&rdquo;/gi, "”")
    .replace(/&ldquo;/gi, "“")
    .replace(/&hellip;/gi, "…")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&euml;/gi, "ë")
    .replace(/&agrave;/gi, "à")
    .replace(/&acirc;/gi, "â")
    .replace(/&icirc;/gi, "î")
    .replace(/&iuml;/gi, "ï")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&ouml;/gi, "ö")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&ucirc;/gi, "û")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    });

  // Convert HTML linebreaks to real linebreaks
  clean = clean
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, ""); // Strip any leftover HTML tags

  return clean;
}

export interface ParsedDateInfo {
  date: Date;
  isAllDay: boolean;
  isUtc: boolean;
  rawDate: string;
  rawTime: string | null;
}

function parseIcsDate(dateStr: string, params: Record<string, string> = {}): ParsedDateInfo {
  const isDateOnly = params["VALUE"] === "DATE" || dateStr.length === 8;

  if (isDateOnly) {
    // Format YYYYMMDD
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10) - 1;
    const d = parseInt(dateStr.slice(6, 8), 10);
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return {
      date: new Date(Date.UTC(y, m, d, 0, 0, 0)),
      isAllDay: true,
      isUtc: false,
      rawDate: `${y}-${mm}-${dd}`,
      rawTime: null,
    };
  }

  // Format YYYYMMDDTHHMMSS[Z]
  const clean = dateStr.replace(/[^0-9TZ]/g, "");
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);

  if (match) {
    const [, y, mo, d, h, mi, s, z] = match;
    const isUtc = Boolean(z);
    const rawDate = `${y}-${mo}-${d}`;
    const rawTime = `${h}:${mi}`;

    if (isUtc) {
      // Pure UTC timestamp (ends with Z)
      return {
        date: new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(mi, 10), parseInt(s, 10))),
        isAllDay: false,
        isUtc: true,
        rawDate,
        rawTime,
      };
    }

    // Local floating or TZID (e.g. Europe/Paris from Zimbra / CalDAV)
    return {
      date: new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(mi, 10), parseInt(s, 10))),
      isAllDay: false,
      isUtc: false,
      rawDate,
      rawTime,
    };
  }

  // Fallback
  const parsed = new Date(dateStr);
  const isValid = !isNaN(parsed.getTime());
  const isUtc = dateStr.endsWith("Z");
  const fallbackDate = isValid ? parsed : new Date();

  return {
    date: fallbackDate,
    isAllDay: isDateOnly,
    isUtc,
    rawDate: format(fallbackDate, "yyyy-MM-dd"),
    rawTime: isDateOnly ? null : format(fallbackDate, "HH:mm"),
  };
}

function parseProperty(line: string): { name: string; params: Record<string, string>; value: string } {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return { name: "", params: {}, value: "" };

  const propPart = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);

  const semiIdx = propPart.indexOf(";");
  if (semiIdx === -1) {
    return { name: propPart.toUpperCase().trim(), params: {}, value };
  }

  const name = propPart.slice(0, semiIdx).toUpperCase().trim();
  const paramStrings = propPart.slice(semiIdx + 1).split(";");
  const params: Record<string, string> = {};

  for (const p of paramStrings) {
    const eqIdx = p.indexOf("=");
    if (eqIdx !== -1) {
      const pName = p.slice(0, eqIdx).toUpperCase().trim();
      const pVal = p.slice(eqIdx + 1).replace(/^"|"$/g, "").trim();
      params[pName] = pVal;
    }
  }

  return { name, params, value };
}

export function parseIcsContent(
  icsString: string,
  calendarId: string,
  calendarName: string,
  calendarColor: string,
  rangeStart: Date,
  rangeEnd: Date
): ExternalCalendarEvent[] {
  const lines = unfoldIcsLines(icsString);
  const events: ExternalCalendarEvent[] = [];

  let inVEvent = false;
  let currentEvent: RawVEvent = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inVEvent = true;
      currentEvent = {};
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (inVEvent && currentEvent.dtstart) {
        processVEvent(currentEvent, calendarId, calendarName, calendarColor, rangeStart, rangeEnd, events);
      }
      inVEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inVEvent) continue;

    const { name, params, value } = parseProperty(line);
    if (!name) continue;

    switch (name) {
      case "SUMMARY":
        currentEvent.summary = unescapeIcsText(value);
        break;
      case "DESCRIPTION":
        currentEvent.description = unescapeIcsText(value);
        break;
      case "LOCATION":
        currentEvent.location = unescapeIcsText(value);
        break;
      case "DTSTART":
        currentEvent.dtstart = value;
        currentEvent.dtstartParams = params;
        break;
      case "DTEND":
        currentEvent.dtend = value;
        currentEvent.dtendParams = params;
        break;
      case "RRULE":
        currentEvent.rrule = value;
        break;
      case "UID":
        currentEvent.uid = value;
        break;
      case "STATUS":
        currentEvent.status = value.toUpperCase();
        break;
    }
  }

  return events;
}

function processVEvent(
  raw: RawVEvent,
  calendarId: string,
  calendarName: string,
  calendarColor: string,
  rangeStart: Date,
  rangeEnd: Date,
  outEvents: ExternalCalendarEvent[]
) {
  if (raw.status === "CANCELLED" || !raw.dtstart) return;

  const startInfo = parseIcsDate(raw.dtstart, raw.dtstartParams);
  const endInfo: ParsedDateInfo = raw.dtend
    ? parseIcsDate(raw.dtend, raw.dtendParams)
    : {
        date: startInfo.isAllDay ? addDays(startInfo.date, 1) : new Date(startInfo.date.getTime() + 60 * 60 * 1000),
        isAllDay: startInfo.isAllDay,
        isUtc: startInfo.isUtc,
        rawDate: startInfo.rawDate,
        rawTime: startInfo.rawTime,
      };

  const title = raw.summary || "Événement sans titre";
  const baseUid = raw.uid || `${raw.dtstart}-${title}`;
  const durationMs = Math.max(0, endInfo.date.getTime() - startInfo.date.getTime());

  if (!raw.rrule) {
    // Single event
    if (isEventInRange(startInfo.date, endInfo.date, rangeStart, rangeEnd, startInfo.isAllDay)) {
      addEventOccurrence(
        baseUid,
        title,
        raw.description,
        raw.location,
        startInfo,
        endInfo,
        calendarId,
        calendarName,
        calendarColor,
        outEvents
      );
    }
    return;
  }

  // Handle Recurring Events (RRULE)
  const rruleParts = parseRRule(raw.rrule);
  expandRRule(
    rruleParts,
    startInfo,
    durationMs,
    baseUid,
    title,
    raw.description,
    raw.location,
    calendarId,
    calendarName,
    calendarColor,
    rangeStart,
    rangeEnd,
    outEvents
  );
}

function parseRRule(rruleStr: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of rruleStr.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k.toUpperCase().trim()] = v.trim();
  }
  return parts;
}

function expandRRule(
  rrule: Record<string, string>,
  startInfo: ParsedDateInfo,
  durationMs: number,
  baseUid: string,
  title: string,
  description?: string,
  location?: string,
  calendarId: string = "",
  calendarName: string = "",
  calendarColor: string = "",
  rangeStart: Date = new Date(),
  rangeEnd: Date = new Date(),
  outEvents: ExternalCalendarEvent[] = []
) {
  const freq = rrule["FREQ"];
  const interval = parseInt(rrule["INTERVAL"] || "1", 10) || 1;
  const count = rrule["COUNT"] ? parseInt(rrule["COUNT"], 10) : 500;
  const until = rrule["UNTIL"] ? parseIcsDate(rrule["UNTIL"]).date : null;

  let currentStart = new Date(startInfo.date.getTime());
  let iterations = 0;

  while (iterations < count && iterations < 500) {
    if (until && isAfter(currentStart, until)) break;
    if (isAfter(currentStart, rangeEnd)) break;

    const currentEnd = new Date(currentStart.getTime() + durationMs);

    if (isEventInRange(currentStart, currentEnd, rangeStart, rangeEnd, startInfo.isAllDay)) {
      const occurrenceDateStr = format(currentStart, "yyyy-MM-dd");
      const occurrenceId = `${baseUid}_${occurrenceDateStr}`;
      const occurrenceStartInfo: ParsedDateInfo = {
        date: currentStart,
        isAllDay: startInfo.isAllDay,
        isUtc: startInfo.isUtc,
        rawDate: occurrenceDateStr,
        rawTime: startInfo.rawTime,
      };
      const occurrenceEndInfo: ParsedDateInfo = {
        date: currentEnd,
        isAllDay: startInfo.isAllDay,
        isUtc: startInfo.isUtc,
        rawDate: format(currentEnd, "yyyy-MM-dd"),
        rawTime: format(currentEnd, "HH:mm"),
      };

      addEventOccurrence(
        occurrenceId,
        title,
        description,
        location,
        occurrenceStartInfo,
        occurrenceEndInfo,
        calendarId,
        calendarName,
        calendarColor,
        outEvents
      );
    }

    iterations++;

    // Increment date according to FREQ
    switch (freq) {
      case "DAILY":
        currentStart = addDays(currentStart, interval);
        break;
      case "WEEKLY":
        currentStart = addWeeks(currentStart, interval);
        break;
      case "MONTHLY":
        currentStart = addMonths(currentStart, interval);
        break;
      case "YEARLY":
        currentStart = addYears(currentStart, interval);
        break;
      default:
        // Unsupported freq
        return;
    }
  }
}

function isEventInRange(start: Date, end: Date, rangeStart: Date, rangeEnd: Date, isAllDay: boolean): boolean {
  if (isAllDay) {
    const sStr = format(start, "yyyy-MM-dd");
    const rsStr = format(rangeStart, "yyyy-MM-dd");
    const reStr = format(rangeEnd, "yyyy-MM-dd");
    return sStr >= rsStr && sStr <= reStr;
  }
  return !(isAfter(start, rangeEnd) || isBefore(end, rangeStart));
}

function addEventOccurrence(
  id: string,
  title: string,
  description?: string,
  location?: string,
  startInfo: ParsedDateInfo | Date = new Date(),
  endInfo: ParsedDateInfo | Date = new Date(),
  calendarId: string = "",
  calendarName: string = "",
  calendarColor: string = "",
  outEvents: ExternalCalendarEvent[] = []
) {
  const isDateObj = startInfo instanceof Date;
  const isAllDay = isDateObj ? false : startInfo.isAllDay;
  const isUtc = isDateObj ? true : startInfo.isUtc;
  const startDate = isDateObj ? startInfo : startInfo.date;
  const endDate = endInfo instanceof Date ? endInfo : endInfo.date;

  let dateStr: string;
  let startTime: string | null;
  let endTime: string | null;
  let startIso: string;
  let endIso: string;

  if (isAllDay) {
    dateStr = isDateObj ? format(startDate, "yyyy-MM-dd") : startInfo.rawDate;
    startTime = null;
    endTime = null;
    startIso = `${dateStr}T00:00:00`;
    endIso = `${dateStr}T23:59:59`;
  } else if (isUtc) {
    // Pure UTC timestamp (Google Calendar, etc.)
    dateStr = format(startDate, "yyyy-MM-dd");
    startTime = format(startDate, "HH:mm");
    endTime = format(endDate, "HH:mm");
    startIso = startDate.toISOString();
    endIso = endDate.toISOString();
  } else {
    // Local / Floating / TZID timestamp (Zimbra, SOGo, Apple Calendar, Beta.gouv)
    dateStr = !isDateObj && startInfo.rawDate ? startInfo.rawDate : format(startDate, "yyyy-MM-dd");
    startTime = !isDateObj && startInfo.rawTime ? startInfo.rawTime : format(startDate, "HH:mm");
    endTime = !(endInfo instanceof Date) && endInfo.rawTime ? endInfo.rawTime : format(endDate, "HH:mm");
    // Local ISO WITHOUT trailing 'Z' so clients know it is already local clock time
    startIso = `${dateStr}T${startTime}:00`;
    endIso = `${dateStr}T${endTime || startTime}:00`;
  }

  outEvents.push({
    id,
    calendarId,
    calendarName,
    calendarColor,
    title,
    description: description || null,
    location: location || null,
    date: dateStr,
    startTime,
    endTime,
    isAllDay,
    startIso,
    endIso,
  });
}
