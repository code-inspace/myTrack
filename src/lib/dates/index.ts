import { format, startOfWeek, addDays, isSameDay, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";

export function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDateToISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDisplayDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "EEEE d MMMM", { locale: fr });
  } catch {
    return dateStr;
  }
}

export function addHoursToTimeString(timeStr: string, hoursToAdd: number = 1): string {
  if (!timeStr || !timeStr.includes(":")) return "08:00";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const totalMinutes = (h * 60 + m + hoursToAdd * 60) % (24 * 60);
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function subtractMinutesFromTime(timeStr: string, minutesToSubtract: number = 0): string {
  if (!timeStr || !timeStr.includes(":")) return "22:00";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  let totalMinutes = h * 60 + m - minutesToSubtract;
  while (totalMinutes < 0) totalMinutes += 24 * 60;
  totalMinutes = totalMinutes % (24 * 60);
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

/**
 * Converts a local time string "HH:mm" from the device's current timezone into UTC "HH:mm".
 */
export function convertLocalTimeToUtc(localTimeStr: string, dateStr?: string): string {
  if (!localTimeStr || !localTimeStr.includes(":")) return localTimeStr;
  const [h, m] = localTimeStr.split(":").map(Number);
  const now = new Date();
  const year = dateStr ? parseInt(dateStr.split("-")[0], 10) : now.getFullYear();
  const month = dateStr ? parseInt(dateStr.split("-")[1], 10) - 1 : now.getMonth();
  const day = dateStr ? parseInt(dateStr.split("-")[2], 10) : now.getDate();

  const d = new Date(year, month, day, h, m, 0);
  const utcH = d.getUTCHours();
  const utcM = d.getUTCMinutes();
  return `${String(utcH).padStart(2, "0")}:${String(utcM).padStart(2, "0")}`;
}

/**
 * Converts a stored UTC time string "HH:mm" (or ISO string) into the device's local timezone "HH:mm".
 */
export function convertUtcTimeToLocal(utcTimeStr: string, dateStr?: string): string {
  if (!utcTimeStr) return utcTimeStr;
  if (utcTimeStr.includes("T") || utcTimeStr.endsWith("Z")) {
    return formatIsoToLocalTime(utcTimeStr);
  }
  if (!utcTimeStr.includes(":")) return utcTimeStr;

  const [utcH, utcM] = utcTimeStr.split(":").map(Number);
  const now = new Date();
  const year = dateStr ? parseInt(dateStr.split("-")[0], 10) : now.getUTCFullYear();
  const month = dateStr ? parseInt(dateStr.split("-")[1], 10) - 1 : now.getUTCMonth();
  const day = dateStr ? parseInt(dateStr.split("-")[2], 10) : now.getUTCDate();

  const d = new Date(Date.UTC(year, month, day, utcH, utcM, 0));
  const localH = d.getHours();
  const localM = d.getMinutes();
  return `${String(localH).padStart(2, "0")}:${String(localM).padStart(2, "0")}`;
}

/**
 * Parses an ISO string (UTC) and returns the formatted local "HH:mm" in the device's timezone.
 */
export function formatIsoToLocalTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

/**
 * Creates a standard ISO timestamp (UTC) from a local "HH:mm" and optional date.
 */
export function createUtcIsoFromLocalDateTime(timeStr: string, dateStr?: string): string {
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  const now = new Date();
  const year = dateStr ? parseInt(dateStr.split("-")[0], 10) : now.getFullYear();
  const month = dateStr ? parseInt(dateStr.split("-")[1], 10) - 1 : now.getMonth();
  const day = dateStr ? parseInt(dateStr.split("-")[2], 10) : now.getDate();

  const localDate = new Date(year, month, day, h, m, 0);
  return localDate.toISOString();
}

const FRENCH_DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/**
 * Returns 7 days for the week, starting on MONDAY (weekStartsOn: 1)
 */
export function getWeekDaysForDate(currentDate: Date = new Date()): Array<{
  date: Date;
  dateStr: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  dayIndex: number; // 0=Dim, 1=Lun, ..., 6=Sam
}> {
  // Start on Monday (weekStartsOn: 1)
  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const today = new Date();

  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(start, i);
    const dayIndex = dayDate.getDay();
    return {
      date: dayDate,
      dateStr: format(dayDate, "yyyy-MM-dd"),
      dayName: FRENCH_DAY_SHORT[dayIndex], // "Lun", "Mar", "Mer"...
      dayNumber: dayDate.getDate(),
      isToday: isSameDay(dayDate, today),
      dayIndex,
    };
  });
}

export function getLast7Days(endDate: Date = new Date()): Array<{
  date: Date;
  dateStr: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  dayIndex: number;
}> {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = subDays(endDate, 6 - i);
    const dayIndex = dayDate.getDay();
    return {
      date: dayDate,
      dateStr: format(dayDate, "yyyy-MM-dd"),
      dayName: FRENCH_DAY_SHORT[dayIndex],
      dayNumber: dayDate.getDate(),
      isToday: isSameDay(dayDate, today),
      dayIndex,
    };
  });
}

interface TaskDateOverrideEntry {
  skipped?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  movedFrom?: string;
}

export function isTaskScheduledForDate(
  recurrence: "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM",
  recurrenceConfig: { days?: number[] } | null | undefined,
  targetDate: Date,
  taskCreatedAt?: string | Date,
  dateOverrides?: Record<string, TaskDateOverrideEntry> | null
): boolean {
  const dayOfWeek = targetDate.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam

  // Per-occurrence drag-to-day overrides take precedence over the recurrence pattern
  if (dateOverrides && recurrence !== "ONCE") {
    const dateStr = format(targetDate, "yyyy-MM-dd");
    const override = dateOverrides[dateStr];
    if (override && typeof override === "object") {
      if (override.skipped) return false;
      // Any other override on a date outside the normal pattern means this occurrence was moved here
      return true;
    }
  }

  if (recurrence === "DAILY") return true;

  if (recurrence === "WEEKDAYS") {
    // Lundi à Vendredi (1 à 5)
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  if (recurrence === "WEEKLY") {
    if (taskCreatedAt) {
      const created = typeof taskCreatedAt === "string" ? parseISO(taskCreatedAt) : taskCreatedAt;
      return dayOfWeek === created.getDay();
    }
    return dayOfWeek === 1; // Lundi par défaut
  }

  if (recurrence === "CUSTOM") {
    if (!recurrenceConfig?.days || recurrenceConfig.days.length === 0) return true;
    return recurrenceConfig.days.includes(dayOfWeek);
  }

  if (recurrence === "ONCE") {
    if (taskCreatedAt) {
      const created = typeof taskCreatedAt === "string" ? parseISO(taskCreatedAt) : taskCreatedAt;
      return isSameDay(targetDate, created);
    }
    return true;
  }

  return true;
}

/**
 * Uncompleted one-shot (ONCE) tasks carry over onto every day after their original date, up to
 * and including today, until they are completed — so they don't silently disappear if missed.
 */
export function isOnceTaskCarriedOver(
  originalDate: string | null | undefined,
  viewDateStr: string,
  todayStr: string,
  hasBeenCompleted: boolean
): boolean {
  if (!originalDate || hasBeenCompleted) return false;
  return viewDateStr > originalDate && viewDateStr <= todayStr;
}

/**
 * Returns true if a time range crosses midnight (e.g. 23:00 -> 02:00)
 */
export function isOvernightTimeRange(
  startTime?: string | null,
  endTime?: string | null
): boolean {
  if (!startTime || !endTime) return false;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = (sh || 0) * 60 + (sm || 0);
  const endMins = (eh || 0) * 60 + (em || 0);
  return endMins < startMins;
}

/**
 * Formats a cross-day time label with clear visual indicators (+1j / Veille)
 */
export function formatCrossDayTimeLabel(
  startTime?: string | null,
  endTime?: string | null,
  overnightPart?: "start" | "end"
): string {
  if (!startTime && !endTime) return "";
  if (!endTime) return startTime || "";
  if (!startTime) return endTime;

  const isOvernight = isOvernightTimeRange(startTime, endTime);
  if (!isOvernight) {
    return `${startTime} - ${endTime}`;
  }

  if (overnightPart === "end") {
    return `(Veille ${startTime}) → ${endTime}`;
  }
  return `${startTime} → ${endTime} (+1j)`;
}

/**
 * Checks whether a scheduled task occurrence is in the past:
 * - If date < today: true
 * - If date > today: false
 * - If date === today:
 *   - If has endTime and not overnight: true if endTime <= current local time
 *   - If overnight (startTime > endTime): false (ends tomorrow)
 *   - If has startTime only: true if startTime <= current local time
 *   - If no time (all-day today): false
 */
export function isTaskInThePast(
  date?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  referenceNow: Date = new Date()
): boolean {
  if (!date) return false;
  const today = formatDateToISO(referenceNow);
  if (date < today) return true;
  if (date > today) return false;

  const nowH = referenceNow.getHours();
  const nowM = referenceNow.getMinutes();
  const nowMinutes = nowH * 60 + nowM;

  if (endTime) {
    const isOvernight = isOvernightTimeRange(startTime, endTime);
    if (isOvernight) {
      return false;
    }
    const [eh, em] = endTime.split(":").map(Number);
    const endMinutes = (eh || 0) * 60 + (em || 0);
    return endMinutes <= nowMinutes;
  }

  if (startTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const startMinutes = (sh || 0) * 60 + (sm || 0);
    return startMinutes <= nowMinutes;
  }

  return false;
}



function getZonedFields(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function isValidTimeZone(timeZone?: string | null): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Server-side equivalent of the device-local helpers: the calendar date "yyyy-MM-dd" and wall-clock
 * time "HH:mm" of an instant in an explicit IANA timezone (the server itself usually runs in UTC).
 */
export function getZonedDateTimeParts(
  instant: Date,
  timeZone?: string | null,
): { dateStr: string; timeStr: string } {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const f = getZonedFields(instant, tz);
  return { dateStr: `${f.year}-${f.month}-${f.day}`, timeStr: `${f.hour}:${f.minute}` };
}

/** Converts a wall-clock "HH:mm" on `dateStr` in `timeZone` into the UTC "HH:mm" stored in the database. */
export function convertZonedTimeToUtc(
  localTimeStr: string,
  dateStr: string,
  timeZone?: string | null,
): string {
  if (!localTimeStr || !localTimeStr.includes(":")) return localTimeStr;
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const [h, m] = localTimeStr.split(":").map(Number);
  const [y, mo, d] = dateStr.split("-").map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, h, m, 0);
  const offsetAt = (ms: number) => {
    const f = getZonedFields(new Date(ms), tz);
    return (
      Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour, +f.minute, +f.second) - ms
    );
  };
  let instant = naiveUtc - offsetAt(naiveUtc);
  instant = naiveUtc - offsetAt(instant);
  const result = new Date(instant);
  return `${String(result.getUTCHours()).padStart(2, "0")}:${String(result.getUTCMinutes()).padStart(2, "0")}`;
}
