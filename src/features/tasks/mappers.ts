import { Task, TaskCompletion, TaskWithCompletion } from "./types";

export function mapTaskWithCompletion(
  task: Task,
  completions: TaskCompletion[],
  selectedDate: string
): TaskWithCompletion {
  const completion = completions.find((c) => c.taskId === task.id && c.date === selectedDate);
  const isCompletedToday = Boolean(completion?.completed);

  // Check for day-specific override
  const override = task.dateOverrides?.[selectedDate];
  const effectiveStartTime = override && override.startTime !== undefined ? override.startTime : task.startTime;
  const effectiveEndTime = override && override.endTime !== undefined ? override.endTime : task.endTime;

  return {
    ...task,
    completion,
    isCompletedToday,
    currentValue: completion?.value ?? 0,
    effectiveStartTime,
    effectiveEndTime,
  };
}

export function sortTasksByPriority(tasks: TaskWithCompletion[]): TaskWithCompletion[] {
  return [...tasks].sort((a, b) => {
    // 1. Active task at the very top
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;

    // 2. Incompleted before completed
    if (!a.isCompletedToday && b.isCompletedToday) return -1;
    if (a.isCompletedToday && !b.isCompletedToday) return 1;

    // 3. Manual drag-and-drop priority order, when set
    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder;
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;

    // 4. Start time if set
    const aTime = a.effectiveStartTime || a.startTime;
    const bTime = b.effectiveStartTime || b.startTime;
    if (aTime && bTime) return aTime.localeCompare(bTime);
    if (aTime) return -1;
    if (bTime) return 1;

    return a.title.localeCompare(b.title);
  });
}
