export function calculateLast7DaysStatus(
  tasks: TaskRecord[],
  completions: CompletionRecord[],
  endDate: Date = new Date()
): DayStatus[] {
  const result: DayStatus[] = [];

  for (let i = 6; i >= 0; i--) {
    const dateObj = subDays(endDate, i);
    const dateStr = format(dateObj, "yyyy-MM-dd");
    const dayName = FRENCH_DAYS[dateObj.getDay()];

    const scheduledTasks = tasks.filter((t) =>
      isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dateObj, t.createdAt)
    );

    const dayCompletions = completions.filter((c) => c.date === dateStr && c.completed);
    const completedCount = dayCompletions.length;
    const totalScheduled = scheduledTasks.length;

    const completionPercentage =
      totalScheduled > 0
        ? Math.round((completedCount / totalScheduled) * 100)
        : completedCount > 0
        ? 100
        : 0;

    let status: "completed" | "missed" | "empty" = "empty";
    if (totalScheduled > 0) {
      status = completedCount >= totalScheduled ? "completed" : completedCount > 0 ? "completed" : "missed";
    } else if (completedCount > 0) {
      status = "completed";
    }

    result.push({
      date: dateStr,
      dayName,
      completedCount,
      totalScheduled,
      completionPercentage,
      isAllCompleted: totalScheduled > 0 ? completedCount >= totalScheduled : completedCount > 0,
      status,
    });
  }

  return result;
}

/**
 * Calculates comprehensive dashboard statistics
 */
export function calculateDashboardStats(
  tasks: TaskRecord[],
  completions: CompletionRecord[],
  period: Period = "week",
  referenceDate: Date = new Date()
): DashboardStats {
  // Filter out one-shot tasks: Dashboard only tracks recurring habits
  const recurringTasks = tasks.filter((t) => t.recurrence && t.recurrence !== "ONCE");
  const recurringTaskIds = new Set(recurringTasks.map((t) => t.id));
  const recurringCompletions = completions.filter((c) => recurringTaskIds.has(c.taskId));

  const habitStreaks = calculateHabitStreakStats(recurringTasks, recurringCompletions, referenceDate);
  const last7DaysStatus = calculateLast7DaysStatus(recurringTasks, recurringCompletions, referenceDate);

  // Period calculation
  const daysInPeriod = period === "week" ? 7 : period === "month" ? 30 : 60;
  let totalScheduledInPeriod = 0;
  let totalCompletedInPeriod = 0;

  for (let i = daysInPeriod - 1; i >= 0; i--) {
    const dateObj = subDays(referenceDate, i);
    const dateStr = format(dateObj, "yyyy-MM-dd");

    const scheduled = recurringTasks.filter((t) =>
      isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dateObj, t.createdAt)
    ).length;

    const completed = recurringCompletions.filter((c) => c.date === dateStr && c.completed).length;

    totalScheduledInPeriod += scheduled;
    totalCompletedInPeriod += completed;
  }

  const completionRate =
    totalScheduledInPeriod > 0
      ? Math.min(100, Math.round((totalCompletedInPeriod / totalScheduledInPeriod) * 100))
      : totalCompletedInPeriod > 0
      ? 100
      : 0;

  // Average habit streak across active habits
  const avgHabitStreak =
    habitStreaks.length > 0
      ? habitStreaks.reduce((acc, h) => acc + h.currentStreak, 0) / habitStreaks.length
      : 0;

  // Adapted Momentum score based on habit completion consistency
  const streakBonus = Math.min(30, Math.round(avgHabitStreak * 8));
  const rawMomentum = Math.round(completionRate * 0.6 + streakBonus + Math.min(10, totalCompletedInPeriod * 1.5));
  const momentum = Math.max(0, Math.min(100, rawMomentum || (completionRate > 0 ? completionRate : 50)));

  // Period-aware Curve Points Generation (Semaine | Mois | Tout le temps)
  const momentumHistory: MomentumPoint[] = [];

  if (period === "week") {
    // 7 days of the reference week (Monday to Sunday)
    for (let i = 0; i < 7; i++) {
      const dayDate = subDays(referenceDate, 6 - i);
      const dayDateStr = format(dayDate, "yyyy-MM-dd");
      const dayCompleted = recurringCompletions.filter((c) => c.date === dayDateStr && c.completed).length;
      const dayScheduled = recurringTasks.filter((t) =>
        isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, dayDate, t.createdAt)
      ).length;

      const dayName = FRENCH_DAYS[dayDate.getDay()];
      const dayScore =
        dayScheduled > 0
          ? Math.round((dayCompleted / dayScheduled) * 100)
          : dayCompleted > 0
          ? 100
          : 0;

      momentumHistory.push({
        date: dayDateStr,
        label: `${dayName} ${format(dayDate, "d")}`,
        score: dayScore,
        completedCount: dayCompleted,
        totalScheduled: dayScheduled,
      });
    }
  } else if (period === "month") {
    // 4 to 5 weekly segments of the month (e.g. Sem 1, Sem 2, Sem 3, Sem 4, Sem 5)
    for (let w = 4; w >= 0; w--) {
      let weekCompleted = 0;
      let weekScheduled = 0;
      const weekEndDate = subDays(referenceDate, w * 6);

      for (let d = 0; d < 6; d++) {
        const currDate = subDays(weekEndDate, d);
        const currDateStr = format(currDate, "yyyy-MM-dd");
        weekCompleted += recurringCompletions.filter((c) => c.date === currDateStr && c.completed).length;
        weekScheduled += recurringTasks.filter((t) =>
          isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, currDate, t.createdAt)
        ).length;
      }

      const weekScore =
        weekScheduled > 0
          ? Math.round((weekCompleted / weekScheduled) * 100)
          : weekCompleted > 0
          ? 100
          : 0;

      momentumHistory.push({
        date: format(weekEndDate, "yyyy-MM-dd"),
        label: `Sem ${5 - w}`,
        score: weekScore,
        completedCount: weekCompleted,
        totalScheduled: weekScheduled,
      });
    }
  } else {
    // All-time: 6 monthly aggregate progression points
    for (let m = 5; m >= 0; m--) {
      let monthCompleted = 0;
      let monthScheduled = 0;
      const monthRef = subDays(referenceDate, m * 30);

      for (let d = 0; d < 30; d++) {
        const currDate = subDays(monthRef, d);
        const currDateStr = format(currDate, "yyyy-MM-dd");
        monthCompleted += recurringCompletions.filter((c) => c.date === currDateStr && c.completed).length;
        monthScheduled += recurringTasks.filter((t) =>
          isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, currDate, t.createdAt)
        ).length;
      }

      const monthScore =
        monthScheduled > 0
          ? Math.round((monthCompleted / monthScheduled) * 100)
          : monthCompleted > 0
          ? 100
          : 0;

      const FRENCH_MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      const monthLabel = FRENCH_MONTHS_SHORT[monthRef.getMonth()];

      momentumHistory.push({
        date: format(monthRef, "yyyy-MM-dd"),
        label: monthLabel,
        score: monthScore,
        completedCount: monthCompleted,
        totalScheduled: monthScheduled,
      });
    }
  }

  const totalWins = totalCompletedInPeriod;
  const totalTargetWins = Math.max(totalWins, totalScheduledInPeriod);