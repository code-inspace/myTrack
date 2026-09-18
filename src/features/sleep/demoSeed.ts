import { DailySleepLog } from "./types";

export function generateDemoSleepLog(dateStr: string): DailySleepLog {
  return {
    date: dateStr,
    bedtime: "",
    wakeTime: "",
    bedtimeValidated: false,
    wakeTimeValidated: false,
    naps: [],
    notes: "",
    gratitude: "",
    manifestation: "",
    updatedAt: new Date().toISOString(),
  };
}

