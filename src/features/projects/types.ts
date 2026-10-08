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

/** Status of a task without project on the "no project" board (plain TODO/DONE). */
export const NO_PROJECT_TODO_STATUS = "TODO";
export const NO_PROJECT_DONE_STATUS = "DONE";

/** Column a task lands in when it joins a project or is reopened: the project's first column. */
export function getFirstColumnId(project: Pick<Project, "columns"> | null | undefined): string {
  if (!project) return NO_PROJECT_TODO_STATUS;
  return getProjectColumns(project)[0]?.id || NO_PROJECT_TODO_STATUS;
}

/** The project's "done" column (isDone flag, else legacy "DONE" id, else last column). */
export function getDoneColumnId(project: Pick<Project, "columns"> | null | undefined): string {
  if (!project) return NO_PROJECT_DONE_STATUS;
  return getProjectColumns(project).find((c) => c.isDone)?.id || NO_PROJECT_DONE_STATUS;
}

/**
 * Whether a task sits in its board's done column — the project's own done column (custom id)
 * or "DONE" for tasks without a project. Never compare projectStatus to "DONE" directly.
 */
export function isTaskInDoneColumn(
  task: { projectId?: string | null; projectStatus?: string | null },
  projects: Array<Pick<Project, "id" | "columns">> = [],
): boolean {
  if (!task.projectStatus) return false;
  if (!task.projectId) return task.projectStatus === NO_PROJECT_DONE_STATUS;
  const project = projects.find((p) => p.id === task.projectId);
  return task.projectStatus === getDoneColumnId(project || { columns: [] });
}

/**
 * The all-projects board has its own (user-editable) columns, while each task's status is a column
 * of its own project (or TODO/DONE without project). A task is shown in the board column with the
 * same id, else the same name; its project's done column always maps to the board's done column.
 */
function normalizeLabel(label?: string | null): string {
  return (label || "").trim().toLowerCase();
}

export function resolveAllBoardColumnId(
  task: { projectId?: string | null; projectStatus?: string | null },
  boardColumns: ProjectColumn[],
  project: Pick<Project, "columns"> | null | undefined,
  isCompleted = false,
): string | undefined {
  const board = getProjectColumns({ columns: boardColumns });
  const boardDone = board.find((c) => c.isDone);
  const ownColumns = getProjectColumns(project || { columns: [] });
  const ownStatus = task.projectStatus || ownColumns[0]?.id;

  if (isCompleted || ownStatus === getDoneColumnId(task.projectId ? project || { columns: [] } : null)) {
    return boardDone?.id ?? board[board.length - 1]?.id;
  }
  if (ownStatus && board.some((c) => c.id === ownStatus)) return ownStatus;
  const ownLabel = normalizeLabel(ownColumns.find((c) => c.id === ownStatus)?.label);
  const byLabel = ownLabel ? board.find((c) => normalizeLabel(c.label) === ownLabel) : undefined;
  return byLabel?.id ?? board[0]?.id;
}

/** Status a task gets when dropped in a board column (inverse of resolveAllBoardColumnId). */
export function resolveStatusForAllBoardColumn(
  task: { projectId?: string | null },
  boardColumn: ProjectColumn,
  project: Pick<Project, "columns"> | null | undefined,
): string {
  const ownColumns = getProjectColumns(project || { columns: [] });
  if (boardColumn.isDone) return getDoneColumnId(task.projectId ? project || { columns: [] } : null);
  if (ownColumns.some((c) => c.id === boardColumn.id)) return boardColumn.id;
  const byLabel = ownColumns.find((c) => normalizeLabel(c.label) === normalizeLabel(boardColumn.label));
  // No equivalent in the task's project: keep the board column (its own board shows it first column)
  return byLabel?.id ?? boardColumn.id;
}
