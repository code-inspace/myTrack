import { DailySleepLog, NapSession } from "./types";
import { subDays, parseISO, format } from "date-fns";

// Duplicated from actions.ts (rather than imported) to keep this seed module dependency-free,
// avoiding a circular import since actions.ts pulls the demo log from here as a fallback.
const DEMO_BEDTIME_OFFSETS = [60, 30, 15];

function hashDateToInt(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return h;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map((v) => parseInt(v, 10) || 0);
  const total = (((h * 60 + m + minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * A single night is fully determined by the date it starts on: bedtime is stored on that date's
 * log, wake time is stored on the following date's log — this computes both from one hash so
 * they always pair up into a realistic (~7h-8h30) night when read back via getNightSleepDuration.
 */
function nightPlanFor(nightStartDateStr: string): { bedtime: string; wakeTime: string } {
  const hash = hashDateToInt(nightStartDateStr);
  const bedtime = addMinutesToTime("23:00", (hash % 61) - 30); // ~22:30-23:30
  const durationMinutes = 420 + (hash % 90); // 7h-8h30
  const wakeTime = addMinutesToTime(bedtime, durationMinutes);
  return { bedtime, wakeTime };
}

/**
 * Deterministically generates a plausible sleep log for the given date (this evening's bedtime +
 * this morning's wake time from last night), with an occasional afternoon nap — so the dashboard
 * sleep chart and the sleep journal have realistic-looking demo data across the whole history
 * window without persisting anything.
 */
export function generateDemoSleepLog(dateStr: string): DailySleepLog {
  return {
    date: dateStr,
    bedtime: "",
    wakeTime: "",
    bedtimeValidated: false,
    wakeTimeValidated: false,
    bedtimeOffsets: DEMO_BEDTIME_OFFSETS,
    bedtimeReminders: [],
    enableBedtimeReminders: false,
    naps: [],
    notes: "",
    gratitude: "",
    manifestation: "",
    updatedAt: new Date().toISOString(),
  };
}
