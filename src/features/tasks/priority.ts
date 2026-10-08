export type TaskPriority = "NORMAL" | "URGENT" | "VERY_URGENT";

export const PRIORITY_OPTIONS: Array<{ id: TaskPriority; label: string }> = [
  { id: "NORMAL", label: "Normale" },
  { id: "URGENT", label: "Urgente" },
  { id: "VERY_URGENT", label: "Très urgente" },
];

/**
 * Priority is shown by shape, not color (tasks are already colored by project): "!" for urgent,
 * "!!" for very urgent, like Apple Reminders. See PriorityBadge.
 */
export function getPriorityMarks(priority?: string | null): string | null {
  if (priority === "VERY_URGENT") return "!!";
  if (priority === "URGENT") return "!";
  return null;
}

export function getPriorityLabel(priority?: string | null): string {
  return PRIORITY_OPTIONS.find((o) => o.id === priority)?.label || "Normale";
}
