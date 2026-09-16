/**
 * Calculates snapped duration and resulting start / end times for task resizing.
 * - 1px = 1 minute
 * - Snaps to 5-minute intervals
 * - Minimum duration: 1 minute (or minDurationMins)
 * - Maximum end time: 23:55 (1435 minutes)
 */
export function calculateResizedDuration(
  initialDurationMins: number,
  deltaYPixels: number,
  minDurationMins: number = 5
): number {
  const rawHeight = initialDurationMins + deltaYPixels;
  const snapped = Math.round(rawHeight / 5) * 5;
  return Math.max(minDurationMins, snapped);
}

export function formatMinutesToTime(totalMins: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 55, totalMins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 9 * 60; // Default 09:00
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function calculateResizedEndMinutes(
  startMins: number,
  initialDurationMins: number,
  deltaYPixels: number,
  minDurationMins: number = 5
): { duration: number; endMins: number; endTimeStr: string } {
  const duration = calculateResizedDuration(initialDurationMins, deltaYPixels, minDurationMins);
  const endMins = Math.min(23 * 60 + 55, startMins + duration);
  const endTimeStr = formatMinutesToTime(endMins);
  return { duration, endMins, endTimeStr };
}

export function calculateTopResizedStartMinutes(
  initialStartMins: number,
  fixedEndMins: number,
  deltaYPixels: number,
  minDurationMins: number = 5
): { startMins: number; startTimeStr: string; duration: number } {
  const rawStart = initialStartMins + deltaYPixels;
  const snappedStart = Math.round(rawStart / 5) * 5;
  const maxStart = fixedEndMins - minDurationMins;
  const startMins = Math.max(0, Math.min(maxStart, snappedStart));
  const startTimeStr = formatMinutesToTime(startMins);
  const duration = fixedEndMins - startMins;
  return { startMins, startTimeStr, duration };
}

