/**
 * Single source of truth for when a sleep counts as the main night vs a daytime nap.
 * A sleep starting between EVENING_START_HOUR and MORNING_END_HOUR (crossing midnight) is the
 * night; anything starting in between is a nap. Bedtimes after midnight (< MORNING_END_HOUR)
 * belong to the night that started the previous evening.
 */
export const SLEEP_EVENING_START_HOUR = 18;
export const SLEEP_MORNING_END_HOUR = 7;

function hourOf(timeStr: string): number {
  return parseInt(timeStr.split(":")[0], 10) || 0;
}

export function isNightSleepHour(hour: number): boolean {
  return hour >= SLEEP_EVENING_START_HOUR || hour < SLEEP_MORNING_END_HOUR;
}

export function isNightSleepTime(timeStr: string): boolean {
  return isNightSleepHour(hourOf(timeStr));
}

/** True for an "after midnight" bedtime that belongs to the previous evening's night. */
export function isAfterMidnightBedtime(timeStr: string): boolean {
  return hourOf(timeStr) < SLEEP_MORNING_END_HOUR;
}

export function isEveningBedtimeHour(hour: number): boolean {
  return hour >= SLEEP_EVENING_START_HOUR;
}
