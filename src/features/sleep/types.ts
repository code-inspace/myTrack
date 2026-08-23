export interface DailySleepLog {
  date: string; // "YYYY-MM-DD"
  bedtime?: string | null; // e.g. "23:00"
  wakeTime?: string | null; // e.g. "07:30"
  bedtimeValidated?: boolean;
  wakeTimeValidated?: boolean;
  bedtimeOffsets?: number[]; // e.g. [60, 30, 15]
  bedtimeReminders: string[]; // e.g. ["22:00", "22:30", "22:45"]
  enableBedtimeReminders: boolean;
  notes?: string; // Daily reflection / comment
  gratitude?: string; // Gratitude journaling
  manifestation?: string; // Manifestation & intentions
  updatedAt?: string;
}
