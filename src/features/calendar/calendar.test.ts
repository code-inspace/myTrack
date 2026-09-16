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
    const pastEvent = { ...dummyEvent, date: "2020-01-01" };
    expect(getExternalEventStatus(pastEvent, "2020-01-01")).toBe("DONE");
    expect(isExternalEventDone(pastEvent, "2020-01-01")).toBe(true);
  });

  it("marks future dates as TODO", () => {
    const futureEvent = { ...dummyEvent, date: "2099-01-01" };
    expect(getExternalEventStatus(futureEvent, "2099-01-01")).toBe("TODO");
    expect(isExternalEventDone(futureEvent, "2099-01-01")).toBe(false);
  });

  it("honors manual completion override", () => {
    const futureEvent = { ...dummyEvent, date: "2099-01-01" };
    const pastEvent = { ...dummyEvent, date: "2020-01-01" };
    expect(getExternalEventStatus(futureEvent, "2099-01-01", true)).toBe("DONE");
    expect(getExternalEventStatus(pastEvent, "2020-01-01", false)).toBe("TODO");
  });
});

import { encryptText, isEncrypted } from "@/lib/crypto/encryption";
import { mapDbSubscriptionToModel } from "./actions/calendarCrud";

describe("Encrypted Calendar Subscriptions Database Mapping", () => {
  it("encrypts and decrypts subscription url, username, password and name transparently", async () => {
    const rawSecretUrl = "https://calendar.google.com/calendar/ical/user%40gmail.com/private-secret-token/basic.ics";
    const rawSecretPass = "SuperSecretCalDAVPassword123!";

    const encryptedUrl = await encryptText(rawSecretUrl);
    const encryptedPass = await encryptText(rawSecretPass);

    expect(isEncrypted(encryptedUrl)).toBe(true);
    expect(isEncrypted(encryptedPass)).toBe(true);
    expect(encryptedUrl).not.toContain("private-secret-token");

    const row = {
      id: "cal-test-1",
      user_id: "user-123",
      name: "Mon Google Pro",
      url: encryptedUrl,
      color: "#3B82F6",
      enabled: true,
      username: "user@example.com",
      password: encryptedPass,
      created_at: "2026-09-02T00:00:00.000Z",
      updated_at: "2026-09-02T00:00:00.000Z",
    };

    const mapped = await mapDbSubscriptionToModel(row);
    expect(mapped.url).toBe(rawSecretUrl);
    expect(mapped.password).toBe(rawSecretPass);
    expect(mapped.name).toBe("Mon Google Pro");
    expect(mapped.enabled).toBe(true);
  });
});

import { generateCandidateUrls, extractCalendarDataFromXml } from "./lib/caldavClient";

describe("Universal CalDAV & Zimbra URL Resolution", () => {
  it("generates Zimbra and CalDAV candidate endpoints for French state email (messagerie.numerique.gouv.fr)", () => {
    const rawUrl = "https://messagerie.numerique.gouv.fr";
    const username = "axel.test@beta.gouv.fr";

    const candidates = generateCandidateUrls(rawUrl, username);
    expect(candidates).toContain("https://messagerie.numerique.gouv.fr");
    expect(candidates).toContain("https://messagerie.numerique.gouv.fr/home/axel.test%40beta.gouv.fr/Calendar.ics");
    expect(candidates).toContain("https://messagerie.numerique.gouv.fr/home/axel.test%40beta.gouv.fr/Calendrier.ics");
    expect(candidates).toContain("https://messagerie.numerique.gouv.fr/home/axel.test%40beta.gouv.fr/Calendar?fmt=ics");
    expect(candidates).toContain("https://messagerie.numerique.gouv.fr/dav/axel.test%40beta.gouv.fr/Calendar?fmt=ics");
  });

  it("extracts VCALENDAR / VEVENT data from CalDAV Multi-Status XML responses", () => {
    const calDavXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/dav/user/Calendar/event-1.ics</D:href>
    <D:propstat>
      <D:prop>
        <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:beta-gouv-event-1
SUMMARY:Point d'équipe Beta.gouv
DTSTART:20260914T100000Z
DTEND:20260914T110000Z
END:VEVENT
END:VCALENDAR</C:calendar-data>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

    const extracted = extractCalendarDataFromXml(calDavXml);
    expect(extracted.length).toBe(1);
    expect(extracted[0]).toContain("BEGIN:VCALENDAR");
    expect(extracted[0]).toContain("Point d'équipe Beta.gouv");
    expect(extracted[0]).toContain("beta-gouv-event-1");
  });
});

import { getExternalEventDurationMinutes } from "./lib/duration";
import { getStoredEventProjects, saveStoredEventProject } from "./actions/storage";

describe("External Calendar Event Duration & Project Association", () => {
  it("computes duration in minutes accurately from startTime and endTime", () => {
    const event: ExternalCalendarEvent = {
      id: "evt-dur-1",
      calendarId: "cal-1",
      calendarName: "Google Pro",
      calendarColor: "#3B82F6",
      title: "Sprint Review",
      date: "2026-09-16",
      startTime: "14:00",
      endTime: "15:30",
      startIso: "2026-09-16T14:00:00.000Z",
      endIso: "2026-09-16T15:30:00.000Z",
      isAllDay: false,
    };

    expect(getExternalEventDurationMinutes(event)).toBe(90);
  });

  it("assigns 60 minutes default block for all-day events", () => {
    const allDayEvent: ExternalCalendarEvent = {
      id: "evt-dur-2",
      calendarId: "cal-1",
      calendarName: "Google Pro",
      calendarColor: "#3B82F6",
      title: "Journée Hackathon",
      date: "2026-09-16",
      startIso: "2026-09-16T00:00:00.000Z",
      endIso: "2026-09-16T23:59:59.000Z",
      isAllDay: true,
    };

    expect(getExternalEventDurationMinutes(allDayEvent)).toBe(60);
  });

  it("persists and reads project and subcategory assignment for an external event", () => {
    saveStoredEventProject("evt-proj-1", { projectId: "proj-123", projectCategory: "Frontend" }, "user-test");
    const mapping = getStoredEventProjects("user-test");
    expect(mapping["evt-proj-1"]).toEqual({ projectId: "proj-123", projectCategory: "Frontend" });

    // Detach project
    saveStoredEventProject("evt-proj-1", { projectId: null }, "user-test");
    const updatedMapping = getStoredEventProjects("user-test");
    expect(updatedMapping["evt-proj-1"]).toBeUndefined();
  });
});

