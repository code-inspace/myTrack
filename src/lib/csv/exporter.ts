import { Task, TaskCompletion } from "@/features/tasks/types";

/**
 * Escapes CSV field value according to RFC 4180
 */
export function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function generateTasksCSV(tasks: Task[]): string {
  const headers = [
    "Task ID",
    "Title",
    "Description",
    "Category",
    "Recurrence",
    "Tracking Type",
    "Target Value",
    "Unit",
    "Start Time",
    "End Time",
    "Is Active",
    "Created At",
  ];

  const rows = tasks.map((t) => [
    t.id,
    t.title,
    t.description || "",
    t.category,
    t.recurrence,
    t.trackingType,
    t.targetValue ?? "",
    t.unit || "",
    t.startTime || "",
    t.endTime || "",
    t.isActive ? "true" : "false",
    t.createdAt,
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\r\n");

  return csvContent;
}

export function generateCompletionsCSV(completions: TaskCompletion[], tasks: Task[]): string {
  const taskMap = new Map(tasks.map((t) => [t.id, t.title]));

  const headers = [
    "Completion ID",
    "Task ID",
    "Task Title",
    "Date (ISO)",
    "Completed Status",
    "Value Recorded",
    "Duration (Seconds)",
    "Notes",
    "Created At",
  ];

  const rows = completions.map((c) => [
    c.id,
    c.taskId,
    taskMap.get(c.taskId) || "Unknown Task",
    c.date,
    c.completed ? "COMPLETED" : "MISSED",
    c.value ?? "",
    c.duration ?? "",
    c.notes || "",
    c.createdAt,
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\r\n");

  return csvContent;
}

/**
 * Initiates browser CSV file download with UTF-8 BOM
 */
export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
