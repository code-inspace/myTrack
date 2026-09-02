import { Project, DEFAULT_PROJECT_COLUMNS } from "./types";
import { subDays } from "date-fns";

export const DEMO_PROJECT_APP_ID = "demo-project-app";
export const DEMO_PROJECT_HOME_ID = "demo-project-home";

/** Custom column scheme, distinct from DEFAULT_PROJECT_COLUMNS, to showcase customizable columns. */
export const DEMO_HOME_COLUMNS = [
  { id: "IDEAS", label: "Idées" },
  { id: "DEVIS", label: "Devis en cours" },
  { id: "TRAVAUX", label: "Travaux" },
  { id: "TERMINE", label: "Terminé", isDone: true },
];

export function generateDemoSeedProjects(_userId: string): Project[] {
  return [];
}
