export type TaskPriority = "NORMAL" | "URGENT" | "VERY_URGENT";

export const PRIORITY_OPTIONS: Array<{ id: TaskPriority; label: string }> = [
  { id: "NORMAL", label: "Normale" },
  { id: "URGENT", label: "Urgente" },
  { id: "VERY_URGENT", label: "Très urgente" },
];

/** Left-edge border + ring treatment, applied to the outer card/block of a task. */
export function getPriorityCardClass(priority?: string | null): string {
  if (priority === "VERY_URGENT") return "border-l-4 border-l-red-500 ring-1 ring-red-500/30";
  if (priority === "URGENT") return "border-l-4 border-l-amber-500";
  return "";
}

/** Title text treatment (color + weight), applied only while the task isn't completed. */
export function getPriorityTitleClass(priority?: string | null): string {
  if (priority === "VERY_URGENT") return "text-red-400 font-extrabold";
  if (priority === "URGENT") return "text-amber-400 font-bold";
  return "";
}

export function getPriorityIconColorClass(priority?: string | null): string {
  if (priority === "VERY_URGENT") return "text-red-500";
  if (priority === "URGENT") return "text-amber-500";
  return "";
}
