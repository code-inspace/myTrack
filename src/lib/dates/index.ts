import { format, startOfWeek, addDays, isSameDay, parseISO, subDays, differenceInCalendarDays } from "date-fns";

export function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDateToISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDisplayDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "EEEE, MMMM d");
  } catch {
    return dateStr;
  }
}

export function getWeekDaysForDate(currentDate: Date = new Date()): Array<{
  date: Date;
  dateStr: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  dayIndex: number; // 0=Sun, 1=Mon, ..., 6=Sat
}> {
  // Start on Sunday (like screenshot: Sun 7, Mon 8, Tue 9, Wed 10, Thu 11, Fri 12, Sat 13)
  const start = startOfWeek(currentDate, { weekStartsOn: 0 });
  const today = new Date();

  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(start, i);
    return {
      date: dayDate,
      dateStr: format(dayDate, "yyyy-MM-dd"),
      dayName: format(dayDate, "EEE"), // "Sun", "Mon", "Tue"...
      dayNumber: dayDate.getDate(),
      isToday: isSameDay(dayDate, today),
      dayIndex: dayDate.getDay(),
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
    return {
      date: dayDate,
      dateStr: format(dayDate, "yyyy-MM-dd"),
      dayName: format(dayDate, "EEE"),
      dayNumber: dayDate.getDate(),
      isToday: isSameDay(dayDate, today),
      dayIndex: dayDate.getDay(),
    };
  });
}

export function isTaskScheduledForDate(
  recurrence: "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM",
  recurrenceConfig: { days?: number[] } | null | undefined,
  targetDate: Date,
  taskCreatedAt?: string | Date
): boolean {
  const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  if (recurrence === "DAILY") return true;

  if (recurrence === "WEEKDAYS") {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  if (recurrence === "WEEKLY") {
    // If created date is available, match the creation day of week, otherwise default to Monday or task day
    if (taskCreatedAt) {
      const created = typeof taskCreatedAt === "string" ? parseISO(taskCreatedAt) : taskCreatedAt;
      return dayOfWeek === created.getDay();
    }
    return dayOfWeek === 1; // Monday default
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
