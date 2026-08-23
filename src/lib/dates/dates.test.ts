import { describe, it, expect } from "vitest";
import {
  convertLocalTimeToUtc,
  convertUtcTimeToLocal,
  formatIsoToLocalTime,
  createUtcIsoFromLocalDateTime,
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
