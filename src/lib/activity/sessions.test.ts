import { describe, it, expect } from "vitest";
import { evaluatePing, normalizeSourceKey, IDLE_WINDOW_MS } from "./sessions";

const t = (s: number) => new Date(1_700_000_000_000 + s * 1000);
const open = (lastPing: number, seconds = 0, credited = 0) => ({
  startedAt: t(0),
  lastPingAt: t(lastPing),
  seconds,
  creditedMinutes: credited,
});

describe("evaluatePing", () => {
  it("a first ping opens a session worth nothing yet", () => {
    expect(evaluatePing(null, t(0), "web")).toMatchObject({ closePrevious: false, minutesToCredit: 0, totalSeconds: 0 });
  });

  it("counts the gap between two pings inside the idle window", () => {
    const r = evaluatePing(open(0), t(60), "web");
    expect(r).toMatchObject({ closePrevious: false, addSeconds: 60, totalSeconds: 60, minutesToCredit: 1 });
  });

  it("credits only the minutes not yet credited", () => {
    const r = evaluatePing(open(60, 60, 1), t(120), "web");
    expect(r.minutesToCredit).toBe(1);
    expect(r.creditedMinutes).toBe(2);
    const sameMinute = evaluatePing(open(60, 60, 1), t(70), "web");
    expect(sameMinute.minutesToCredit).toBe(0);
  });

  it("closes the session and counts nothing when the silence exceeds the idle window", () => {
    const gap = IDLE_WINDOW_MS.web / 1000 + 1;
    expect(evaluatePing(open(0, 300, 5), t(gap), "web")).toMatchObject({ closePrevious: true, minutesToCredit: 0 });
  });

  it("is more patient with Claude Code than with a web heartbeat", () => {
    const tenMinutes = 10 * 60;
    expect(evaluatePing(open(0), t(tenMinutes), "claude-code").closePrevious).toBe(false);
    expect(evaluatePing(open(0), t(tenMinutes), "web").closePrevious).toBe(true);
  });
});

describe("normalizeSourceKey", () => {
  it("makes a stable slug", () => {
    expect(normalizeSourceKey("  Let's Cook ")).toBe("let-s-cook");
    expect(normalizeSourceKey("Job_Tracker")).toBe("job_tracker");
  });
  it("rejects empty or non-string keys", () => {
    expect(normalizeSourceKey("***")).toBeNull();
    expect(normalizeSourceKey(42)).toBeNull();
  });
});
