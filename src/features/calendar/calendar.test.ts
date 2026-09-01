import { describe, it, expect } from "vitest";
import { parseIcsContent } from "./lib/parser";
import { parseISO } from "date-fns";

describe("iCalendar Parser (RFC 5545)", () => {
  const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:event-1@google.com
SUMMARY:Réunion Produit
DESCRIPTION:Discussion roadmap Q4
LOCATION:Salle de réunion A & Google Meet
DTSTART:20260901T090000Z
DTEND:20260901T103000Z
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:event-allday@google.com
SUMMARY:Anniversaire Maxime
DTSTART;VALUE=DATE:20260901
DTEND;VALUE=DATE:20260902
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:event-recurring@google.com
SUMMARY:Point d'équipe Hebdo
DTSTART:20260901T140000Z
DTEND:20260901T150000Z
RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=5
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:event-cancelled@google.com
SUMMARY:Événement Annulé
DTSTART:20260901T110000Z
DTEND:20260901T120000Z
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

  it("parses single timed events correctly", () => {
    const rangeStart = parseISO("2026-08-30");
    const rangeEnd = parseISO("2026-09-10");

    const events = parseIcsContent(
      sampleIcs,
      "cal-1",
      "Google Pro",
      "#3B82F6",
      rangeStart,
      rangeEnd
    );

    const timedEvent = events.find((e) => e.title === "Réunion Produit");
    expect(timedEvent).toBeDefined();
    expect(timedEvent?.isAllDay).toBe(false);
    expect(timedEvent?.calendarName).toBe("Google Pro");
    expect(timedEvent?.location).toBe("Salle de réunion A & Google Meet");
    expect(timedEvent?.description).toBe("Discussion roadmap Q4");
  });

  it("parses all-day events correctly", () => {
    const rangeStart = parseISO("2026-08-30");
    const rangeEnd = parseISO("2026-09-10");

    const events = parseIcsContent(
      sampleIcs,
      "cal-1",
      "Google Pro",
      "#3B82F6",
      rangeStart,
      rangeEnd
    );

    const allDayEvent = events.find((e) => e.title === "Anniversaire Maxime");
    expect(allDayEvent).toBeDefined();
    expect(allDayEvent?.isAllDay).toBe(true);
    expect(allDayEvent?.date).toBe("2026-09-01");
  });

  it("ignores cancelled events", () => {
    const rangeStart = parseISO("2026-08-30");
    const rangeEnd = parseISO("2026-09-10");

    const events = parseIcsContent(
      sampleIcs,
      "cal-1",
      "Google Pro",
      "#3B82F6",
      rangeStart,
      rangeEnd
    );

    const cancelled = events.find((e) => e.title === "Événement Annulé");
    expect(cancelled).toBeUndefined();
  });

  it("expands recurring events across dates", () => {
    const rangeStart = parseISO("2026-08-30");
    const rangeEnd = parseISO("2026-09-30");

    const events = parseIcsContent(
      sampleIcs,
      "cal-1",
      "Google Pro",
      "#3B82F6",
      rangeStart,
      rangeEnd
    );

    const recurringOccurrences = events.filter((e) =>
      e.title.includes("Point d'équipe Hebdo")
    );
    expect(recurringOccurrences.length).toBeGreaterThanOrEqual(2);
  });
});

import { getExternalEventStatus, isExternalEventDone } from "./lib/status";
import { ExternalCalendarEvent } from "./types";

describe("External Calendar Event Status", () => {
  const dummyEvent: ExternalCalendarEvent = {
    id: "evt-1",
    calendarId: "cal-1",
    calendarName: "Google Pro",
    calendarColor: "#3B82F6",
    title: "Session Focus",
    date: "2026-09-01",
    startTime: "09:00",
    endTime: "10:00",
    startIso: "2026-09-01T09:00:00.000Z",
    endIso: "2026-09-01T10:00:00.000Z",
    isAllDay: false,
  };

  it("marks past dates as DONE", () => {
    expect(getExternalEventStatus(dummyEvent, "2020-01-01")).toBe("DONE");
    expect(isExternalEventDone(dummyEvent, "2020-01-01")).toBe(true);
  });

  it("marks future dates as TODO", () => {
    expect(getExternalEventStatus(dummyEvent, "2099-01-01")).toBe("TODO");
    expect(isExternalEventDone(dummyEvent, "2099-01-01")).toBe(false);
  });

  it("honors manual completion override", () => {
    expect(getExternalEventStatus(dummyEvent, "2099-01-01", true)).toBe("DONE");
    expect(getExternalEventStatus(dummyEvent, "2020-01-01", false)).toBe("TODO");
  });
});
