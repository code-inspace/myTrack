export type ProjectStatus = "TODO" | "IN_PROGRESS" | "WAITING" | "DONE";

export interface Project {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_STATUS_COLUMNS: Array<{ id: ProjectStatus; label: string }> = [
  { id: "TODO", label: "À faire" },
  { id: "IN_PROGRESS", label: "En cours" },
  { id: "WAITING", label: "En attente" },
  { id: "DONE", label: "Fait" },
];
