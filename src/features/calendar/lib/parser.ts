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

function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(dateStr: string, params: Record<string, string> = {}): { date: Date; isAllDay: boolean } {
  const isDateOnly = params["VALUE"] === "DATE" || dateStr.length === 8;

  if (isDateOnly) {
    // Format YYYYMMDD
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10) - 1;
    const d = parseInt(dateStr.slice(6, 8), 10);
    return { date: new Date(Date.UTC(y, m, d, 0, 0, 0)), isAllDay: true };
  }

  // Format YYYYMMDDTHHMMSS[Z]
  const clean = dateStr.replace(/[^0-9TZ]/g, "");
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);

  if (match) {
    const [, y, mo, d, h, mi, s, z] = match;
    if (z) {
      // UTC time
      return {
        date: new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(mi, 10), parseInt(s, 10))),
        isAllDay: false,
      };
    }
    // Local floating or TZID
    return {
      date: new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(mi, 10), parseInt(s, 10)),
      isAllDay: false,
    };
  }

  // Fallback
  const parsed = new Date(dateStr);
  return {
    date: isNaN(parsed.getTime()) ? new Date() : parsed,
    isAllDay: isDateOnly,
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
  const endInfo = raw.dtend
    ? parseIcsDate(raw.dtend, raw.dtendParams)
    : {
        date: startInfo.isAllDay ? addDays(startInfo.date, 1) : new Date(startInfo.date.getTime() + 60 * 60 * 1000),
        isAllDay: startInfo.isAllDay,
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
        startInfo.date,
        endInfo.date,
        startInfo.isAllDay,
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
    startInfo.date,
    durationMs,
    startInfo.isAllDay,
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
  dtstart: Date,
  durationMs: number,
  isAllDay: boolean,
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

  let currentStart = new Date(dtstart.getTime());
  let iterations = 0;

  while (iterations < count && iterations < 500) {
    if (until && isAfter(currentStart, until)) break;
    if (isAfter(currentStart, rangeEnd)) break;

    const currentEnd = new Date(currentStart.getTime() + durationMs);

    if (isEventInRange(currentStart, currentEnd, rangeStart, rangeEnd, isAllDay)) {
      const occurrenceDateStr = format(currentStart, "yyyy-MM-dd");
      const occurrenceId = `${baseUid}_${occurrenceDateStr}`;
      addEventOccurrence(
        occurrenceId,
        title,
        description,
        location,
        currentStart,
        currentEnd,
        isAllDay,
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
  start: Date = new Date(),
  end: Date = new Date(),
  isAllDay: boolean = false,
  calendarId: string = "",
  calendarName: string = "",
  calendarColor: string = "",
  outEvents: ExternalCalendarEvent[] = []
) {
  const dateStr = format(start, "yyyy-MM-dd");
  const startTime = isAllDay ? null : format(start, "HH:mm");
  const endTime = isAllDay ? null : format(end, "HH:mm");

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
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  });
}
