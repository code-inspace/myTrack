export interface NapSession {
  id: string;
  startTime: string; // "HH:MM" local
  endTime: string | null; // "HH:MM" local, null while the nap is still ongoing
  taskId?: string;
  title?: string;
}

export interface DailySleepLog {
  date: string; // "YYYY-MM-DD"
  bedtime?: string | null; // e.g. "23:00"
  wakeTime?: string | null; // e.g. "07:30"
  bedtimeValidated?: boolean;
  wakeTimeValidated?: boolean;
  naps?: NapSession[]; // Daytime rests logged via the "Je me couche / réveille maintenant" quick actions
  notes?: string; // Daily reflection / comment
  gratitude?: string; // Gratitude journaling
  manifestation?: string; // Manifestation & intentions
  updatedAt?: string;
}

