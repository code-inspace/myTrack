import { describe, it, expect } from "vitest";
import {
  convertLocalTimeToUtc,
  convertUtcTimeToLocal,
  formatIsoToLocalTime,
  createUtcIsoFromLocalDateTime,
  isTaskInThePast,
} from "./index";

describe("Timezone and UTC conversion helpers", () => {
  it("converts local time to UTC and back accurately", () => {
    const localTime = "18:30";
    const today = "2026-08-23";

    const utcTime = convertLocalTimeToUtc(localTime, today);
    expect(utcTime).toMatch(/^\d{2}:\d{2}$/);

    const backToLocal = convertUtcTimeToLocal(utcTime, today);
    expect(backToLocal).toBe(localTime);
  });

  it("handles null / empty / malformed strings gracefully", () => {
    expect(convertLocalTimeToUtc("")).toBe("");
    expect(convertUtcTimeToLocal("")).toBe("");
    expect(formatIsoToLocalTime("invalid")).toBe("invalid");
  });

  it("converts ISO strings to device local time", () => {
    const d = new Date();
    d.setHours(14, 45, 0, 0);
    const iso = d.toISOString();

    const localFormatted = formatIsoToLocalTime(iso);
    expect(localFormatted).toBe("14:45");
  });

  it("creates UTC ISO string from local time", () => {
    const iso = createUtcIsoFromLocalDateTime("09:15", "2026-08-23");
    const d = new Date(iso);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(15);
  });
});

describe("isTaskInThePast helper", () => {
  const refDate = new Date(2026, 8, 21, 14, 30); // 2026-09-21 at 14:30

  it("returns true for dates strictly before today", () => {
    expect(isTaskInThePast("2026-09-20", "10:00", "11:00", refDate)).toBe(true);
    expect(isTaskInThePast("2026-09-15", null, null, refDate)).toBe(true);
  });

  it("returns false for dates strictly after today", () => {
    expect(isTaskInThePast("2026-09-22", "10:00", "11:00", refDate)).toBe(false);
    expect(isTaskInThePast("2026-09-25", null, null, refDate)).toBe(false);
  });

  it("evaluates times correctly when date is today", () => {
    // End time is past (10:00 - 11:00 vs 14:30)
    expect(isTaskInThePast("2026-09-21", "10:00", "11:00", refDate)).toBe(true);
    // End time is exactly now (14:30 vs 14:30)
    expect(isTaskInThePast("2026-09-21", "13:30", "14:30", refDate)).toBe(true);
    // End time is in the future (14:00 - 15:00 vs 14:30)
    expect(isTaskInThePast("2026-09-21", "14:00", "15:00", refDate)).toBe(false);
    // Future task (16:00 - 17:00 vs 14:30)
    expect(isTaskInThePast("2026-09-21", "16:00", "17:00", refDate)).toBe(false);
  });

  it("handles overnight tasks starting today as future", () => {
    // Overnight task starting tonight at 23:00 and ending tomorrow at 07:00
    expect(isTaskInThePast("2026-09-21", "23:00", "07:00", refDate)).toBe(false);
  });

  it("handles start time only", () => {
    expect(isTaskInThePast("2026-09-21", "10:00", null, refDate)).toBe(true);
    expect(isTaskInThePast("2026-09-21", "16:00", null, refDate)).toBe(false);
  });

  it("handles all-day task on today as ongoing (not past)", () => {
    expect(isTaskInThePast("2026-09-21", null, null, refDate)).toBe(false);
  });
});
