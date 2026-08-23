  const averageDailyCompletion = Math.round(completionRate);
  const tasksMissed = Math.max(0, totalScheduledInPeriod - totalCompletedInPeriod);
  const globalStreak = calculateCurrentStreak(recurringCompletions, referenceDate);
  const bestGlobalStreak = calculateBestStreak(recurringCompletions);

  return {
    momentum,
    momentumDelta: 10,
    momentumHistory,
    completionRate,
    totalWins,
    totalTargetWins,
    currentStreak: globalStreak,
    bestStreak: Math.max(bestGlobalStreak, globalStreak),
    last7DaysStatus,
    habitStreaks,
    tasksCompleted: totalCompletedInPeriod,
    tasksMissed,
    averageDailyCompletion,
  };
}
