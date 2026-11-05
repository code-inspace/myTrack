import { describe, it, expect } from "vitest";
import {
  buildItems,
  planTotals,
  suggestOrder,
  previewTimeline,
  formatCountdown,
  formatMinutes,
  MINUTE_MS,
} from "./plan";
import {
  startSession,
  sessionReducer,
  remainingMs,
  projectedEndMs,
  overrunMs,
  planShrink,
  isWarning,
  currentItem,
} from "./sessionMachine";
import type { PlanBlock } from "./types";

const block = (id: string, minutes: number, extra: Partial<PlanBlock> = {}): PlanBlock => ({
  id,
  taskId: id,
  title: id,
  minutes,
  ...extra,
});

let counter = 0;
const ids = () => `b${++counter}`;
const T0 = new Date("2026-11-05T14:00:00").getTime();

function threeHourSession(breaks = false) {
  const blocks = [block("postulation", 60), block("revision", 60), block("sport", 60)];
  const items = buildItems(blocks, { enabled: breaks, minutes: 5 }, ids);
  return startSession(items, T0 + 180 * MINUTE_MS + (breaks ? 10 * MINUTE_MS : 0), T0, "s1");
}

describe("planning", () => {
  it("totals the plan and says how much is free", () => {
    const blocks = [block("a", 60), block("b", 60), block("c", 60)];
    expect(planTotals(blocks, { enabled: false, minutes: 5 }, 180).freeMinutes).toBe(0);
    expect(planTotals(blocks, { enabled: true, minutes: 5 }, 180)).toMatchObject({ breakMinutes: 10, freeMinutes: -10 });
  });

  it("interleaves breaks only between tasks", () => {
    const items = buildItems([block("a", 30), block("b", 30)], { enabled: true, minutes: 5 }, ids);
    expect(items.map((i) => i.kind)).toEqual(["task", "break", "task"]);
    const slots = previewTimeline(items, T0);
    expect(slots[2].startMs - T0).toBe(35 * MINUTE_MS);
  });

  it("suggests an order by pin, priority, deadline then length, with reasons", () => {
    const blocks = [
      block("lecture", 30),
      block("deadline", 45, { deadline: "2026-11-06" }),
      block("urgent", 20, { priority: "URGENT" }),
      block("pinned", 10, { pinned: true }),
      block("long", 90),
    ];
    const { blocks: ordered, reasons } = suggestOrder(blocks);
    expect(ordered.map((b) => b.id)).toEqual(["pinned", "urgent", "deadline", "long", "lecture"]);
    expect(reasons.urgent).toBe("Urgente");
    expect(reasons.pinned).toContain("Épinglée");
  });

  it("formats durations and countdowns", () => {
    expect(formatMinutes(90)).toBe("1h30");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(3_725_000)).toBe("1:02:05");
    expect(formatCountdown(-12_000)).toBe("00:12");
  });
});

describe("session timer", () => {
  it("counts down from an absolute end and warns during the last 5 minutes", () => {
    const s = threeHourSession();
    expect(remainingMs(s, T0 + 10 * MINUTE_MS)).toBe(50 * MINUTE_MS);
    expect(isWarning(s, T0 + 54 * MINUTE_MS)).toBe(false);
    expect(isWarning(s, T0 + 56 * MINUTE_MS)).toBe(true);
    expect(isWarning(s, T0 + 61 * MINUTE_MS)).toBe(false); // already over: that's overtime, not a warning
  });

  it("pausing freezes the countdown and resuming pushes the end back", () => {
    let s = threeHourSession();
    s = sessionReducer(s, { type: "pause", now: T0 + 10 * MINUTE_MS });
    expect(remainingMs(s, T0 + 25 * MINUTE_MS)).toBe(50 * MINUTE_MS);
    s = sessionReducer(s, { type: "resume", now: T0 + 25 * MINUTE_MS });
    expect(remainingMs(s, T0 + 25 * MINUTE_MS)).toBe(50 * MINUTE_MS);
    expect(currentItem(s)?.pausedMs).toBe(15 * MINUTE_MS);
  });

  it("extending a block moves the projected end and creates an overrun when nothing is spare", () => {
    let s = threeHourSession();
    expect(overrunMs(s, T0)).toBe(0);
    s = sessionReducer(s, { type: "extend", now: T0 + 30 * MINUTE_MS, minutes: 5 });
    expect(overrunMs(s, T0 + 30 * MINUTE_MS)).toBe(5 * MINUTE_MS);
    expect(projectedEndMs(s, T0 + 30 * MINUTE_MS)).toBe(T0 + 185 * MINUTE_MS);
  });

  it("finishing early frees time (no overrun) and records the real duration", () => {
    let s = threeHourSession();
    s = sessionReducer(s, { type: "finish", now: T0 + 40 * MINUTE_MS });
    expect(s.items[0]).toMatchObject({ state: "done", actualMs: 40 * MINUTE_MS });
    expect(currentItem(s)?.title).toBe("revision");
    expect(overrunMs(s, T0 + 40 * MINUTE_MS)).toBe(0);
  });

  it("choice 1 — shift the end: following blocks stay as planned, the session ends later", () => {
    let s = threeHourSession();
    const now = T0 + 55 * MINUTE_MS;
    s = sessionReducer(s, { type: "extend", now, minutes: 10 });
    s = sessionReducer(s, { type: "shift_end", now });
    expect(s.sessionEndMs).toBe(T0 + 190 * MINUTE_MS);
    expect(overrunMs(s, now)).toBe(0);
    expect(s.items[1].plannedMs).toBe(60 * MINUTE_MS);
  });

  it("choice 2 — shrink the following blocks, in proportion, keeping the end", () => {
    let s = threeHourSession();
    const now = T0 + 55 * MINUTE_MS;
    s = sessionReducer(s, { type: "extend", now, minutes: 10 });
    const plan = planShrink(s, now);
    expect(plan.absorbedMs).toBe(10 * MINUTE_MS);
    expect(plan.remainingOverflowMs).toBe(0);
    expect(plan.changes.map((c) => [c.title, c.fromMinutes, c.toMinutes])).toEqual([
      ["revision", 60, 55],
      ["sport", 60, 55],
    ]);
    s = sessionReducer(s, { type: "shrink", now });
    expect(s.sessionEndMs).toBe(T0 + 180 * MINUTE_MS);
    expect(overrunMs(s, now)).toBe(0);
  });

  it("shrinking never goes under the minimum and moves the end by what it can't absorb", () => {
    const items = buildItems([block("a", 30), block("b", 8)], { enabled: false, minutes: 5 }, ids);
    let s = startSession(items, T0 + 38 * MINUTE_MS, T0, "s2");
    const now = T0 + 10 * MINUTE_MS;
    s = sessionReducer(s, { type: "extend", now, minutes: 30 });
    const plan = planShrink(s, now);
    expect(plan.changes).toEqual([{ itemId: "b", title: "b", fromMinutes: 8, toMinutes: 5 }]);
    expect(plan.remainingOverflowMs).toBe(27 * MINUTE_MS);
    s = sessionReducer(s, { type: "shrink", now });
    expect(overrunMs(s, now)).toBe(0); // the remainder moved the end, which the choice announced
  });

  it("ends the session after the last item", () => {
    let s = startSession(buildItems([block("a", 10)], { enabled: false, minutes: 5 }, ids), T0 + 10 * MINUTE_MS, T0, "s3");
    s = sessionReducer(s, { type: "finish", now: T0 + 9 * MINUTE_MS });
    expect(s.status).toBe("finished");
  });
});
