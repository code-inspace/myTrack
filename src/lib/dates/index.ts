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

export function isTaskScheduledForDate(
  recurrence: "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM",
  recurrenceConfig: { days?: number[] } | null | undefined,
  targetDate: Date,
  taskCreatedAt?: string | Date
): boolean {
  const dayOfWeek = targetDate.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam

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
