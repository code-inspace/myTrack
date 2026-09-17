export type GoalPeriodType = "day" | "week" | "month";

export interface Goal {
  id: string;
  userId: string;
  title?: string;
  projectId: string;          // ID du projet associé
  projectCategory?: string;   // Optionnel : Nom du sous-projet / sous-catégorie
  periodType: GoalPeriodType; // "day" | "week" | "month"
  targetMinutes: number;      // Durée cible en minutes (ex: 180 pour 3h, 600 pour 10h)
  color?: string;             // Couleur personnalisée ou couleur du projet
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgressResult {
  actualMinutes: number;
  targetMinutes: number;
  percentage: number;
  isCompleted: boolean;
  isOverachieved: boolean;
  formattedActual: string;
  formattedTarget: string;
  formattedRemaining: string;
}

export function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
