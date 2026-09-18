import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordAppBackground,
  processAppForeground,
  initAutoSleepTracking,
} from "./autoSleepTracker";

describe("AutoSleepTracker Disabled", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
    });
    vi.stubGlobal("window", {});
  });

  it("does not automatically detect sleep when app is in background or foreground", () => {
    const closedTime = new Date("2026-09-15T23:30:00.000Z");
    recordAppBackground(closedTime);

    const openedTime = new Date("2026-09-16T08:00:00.000Z");
    const result = processAppForeground(openedTime);

    expect(result.detected).toBe(false);
    expect(result.reason).toContain("Automatic sleep detection is disabled");
  });

  it("initAutoSleepTracking returns a cleanup function without side effects", () => {
    const cleanup = initAutoSleepTracking();
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
