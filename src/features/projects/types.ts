export interface ProjectColumn {
  id: string;
  label: string;
}

export const DEFAULT_PROJECT_COLUMNS: ProjectColumn[] = [
  { id: "TODO", label: "À faire" },
  { id: "IN_PROGRESS", label: "En cours" },
  { id: "WAITING", label: "En attente" },
  { id: "DONE", label: "Fait" },
];

export interface Project {
  id: string;
  userId: string;
  name: string;
  color: string;
  columns: ProjectColumn[];
  createdAt: string;
  updatedAt: string;
}

export function getProjectColumns(project: Pick<Project, "columns">): ProjectColumn[] {
  return project.columns && project.columns.length > 0 ? project.columns : DEFAULT_PROJECT_COLUMNS;
}

export function generateColumnId(): string {
  return "col-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
