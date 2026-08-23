import { Task, TaskCompletion, TaskWithCompletion } from "./types";

export function mapTaskWithCompletion(
  task: Task,
  completions: TaskCompletion[],
  selectedDate: string
): TaskWithCompletion {
  const completion = completions.find((c) => c.taskId === task.id && c.date === selectedDate);
  const isCompletedToday = Boolean(completion?.completed);

  return {
    ...task,
    completion,
    isCompletedToday,
    currentValue: completion?.value ?? 0,
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

    // 3. Start time if set
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;

    return a.title.localeCompare(b.title);
  });
}
