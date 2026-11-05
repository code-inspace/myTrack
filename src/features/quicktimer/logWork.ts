import { format } from "date-fns";
import { closeTaskAsCompleted, createDbTask } from "@/features/tasks/actions";
import { formatClock } from "@/features/session/plan";
import { blockToLog, type QuickTarget } from "./quickTimer";

/**
 * Records time that was really spent as a finished task, so goals, the agenda and the Bilan all
 * count it without any planning step.
 */
export async function logWork(params: {
  target: QuickTarget;
  endMs: number;
  minutes: number;
  userId: string;
}): Promise<{ taskId: string; minutes: number }> {
  const { target, endMs, userId } = params;
  const block = blockToLog(endMs - params.minutes * 60_000, endMs, params.minutes);
  const date = format(new Date(block.endMs), "yyyy-MM-dd");

  const created = await createDbTask({
    userId,
    title: target.label,
    description: null,
    tag: "General",
    category: "General",
    projectId: target.projectId,
    projectCategory: target.projectCategory ?? null,
    startTime: formatClock(block.startMs),
    endTime: formatClock(block.endMs),
    recurrence: "ONCE",
    trackingType: "DURATION",
    targetValue: block.minutes,
    unit: "min",
    isActive: false,
    isArchived: false,
    enableReminders: false,
    priority: "NORMAL",
    date,
    completed: false,
  } as unknown as Parameters<typeof createDbTask>[0]);

  await closeTaskAsCompleted(created.id, date, userId, { duration: block.minutes });
  return { taskId: created.id, minutes: block.minutes };
}
