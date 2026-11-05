import { describe, expect, it } from "vitest";
import { blockToLog, clampMinutes, elapsedMinutes, formatElapsed, looksForgotten } from "./quickTimer";

describe("quick timer rules", () => {
  it("counts whole elapsed minutes", () => {
    expect(elapsedMinutes(0, 59_000)).toBe(0);
    expect(elapsedMinutes(0, 61_000)).toBe(1);
    expect(elapsedMinutes(5_000, 0)).toBe(0);
  });

  it("flags a timer left running", () => {
    expect(looksForgotten(0, 119 * 60_000)).toBe(false);
    expect(looksForgotten(0, 120 * 60_000)).toBe(true);
  });

  it("clamps typed durations", () => {
    expect(clampMinutes(NaN)).toBe(0);
    expect(clampMinutes(-5)).toBe(0);
    expect(clampMinutes(45.4)).toBe(45);
    expect(clampMinutes(5000)).toBe(720);
  });

  it("formats the elapsed time", () => {
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });

  it("logs the block ending at the stop time", () => {
    const end = new Date(2026, 10, 5, 15, 0).getTime();
    const block = blockToLog(end - 90 * 60_000, end, 90);
    expect(block.minutes).toBe(90);
    expect(block.startMs).toBe(end - 90 * 60_000);
  });

  it("never starts the block before midnight of the end day", () => {
    const end = new Date(2026, 10, 5, 0, 30).getTime();
    const block = blockToLog(end - 120 * 60_000, end, 120);
    expect(block.minutes).toBe(30);
    expect(new Date(block.startMs).getDate()).toBe(5);
  });
});
