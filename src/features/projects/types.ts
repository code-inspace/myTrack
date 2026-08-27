export interface ProjectColumn {
  id: string;
  label: string;
  /** Dropping/moving a task into this column marks it as completed. */
  isDone?: boolean;
}

export const DEFAULT_PROJECT_COLUMNS: ProjectColumn[] = [
  { id: "TODO", label: "À faire" },
  { id: "IN_PROGRESS", label: "En cours" },
  { id: "WAITING", label: "En attente" },
  { id: "DONE", label: "Fait", isDone: true },
];

export interface Project {
  id: string;
  userId: string;
  name: string;
  color: string;
  columns: ProjectColumn[];
  categories?: string[];
  createdAt: string;
  updatedAt: string;
}

export function getProjectColumns(project: Pick<Project, "columns">): ProjectColumn[] {
  const columns = project.columns && project.columns.length > 0 ? project.columns : DEFAULT_PROJECT_COLUMNS;
  if (columns.some((c) => c.isDone)) return columns;

  // Legacy projects saved before the per-column "isDone" flag existed have none set — fall back
  // to the conventional "DONE" id (or the last column) so a done column always exists.
  const fallbackId = columns.find((c) => c.id === "DONE")?.id ?? columns[columns.length - 1]?.id;
  return columns.map((c) => (c.id === fallbackId ? { ...c, isDone: true } : c));
}

export function generateColumnId(): string {
  return "col-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
