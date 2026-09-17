import { format, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Period } from "@/features/dashboard/types";

export type GoalPeriodType = "day" | "week" | "month";
export type GoalTargetType = "duration" | "count"; // "duration" = en temps (minutes/heures), "count" = nombre de fois / séances

export interface Goal {
  id: string;
  userId: string;
  title?: string;
  projectId: string;          // ID du projet associé
  projectCategory?: string;   // Optionnel : Nom du sous-projet unique (rétrocompatibilité)
  projectCategories?: string[]; // Optionnel : Liste de plusieurs sous-projets / sous-catégories ciblés
  periodType: GoalPeriodType; // "day" | "week" | "month"
  periodKey?: string;         // Clé de période unique (ex: "2026-09-17", "week_2026-09-15", "month_2026-09")
  targetType?: GoalTargetType;// "duration" (par défaut) | "count"
  targetMinutes: number;      // Durée cible en minutes (si targetType === "duration")
  targetCount?: number;       // Nombre de séances / occurrences visées (si targetType === "count", ex: 2, 3, 5)
  unit?: string;              // Optionnel : Libellé de l'unité (ex: "séance", "fois")
  color?: string;             // Couleur personnalisée ou couleur du projet
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgressResult {
  targetType: GoalTargetType;
  actualMinutes: number;
  targetMinutes: number;
  actualCount?: number;
  targetCount?: number;
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

export function formatCountUnit(count: number, customUnit?: string): string {
  if (customUnit && customUnit.trim()) {
    const u = customUnit.trim();
    if (u.toLowerCase() === "fois") return `${count} fois`;
    if (u.toLowerCase() === "séance" || u.toLowerCase() === "séances") {
      return `${count} ${count > 1 ? "séances" : "séance"}`;
    }
    if (u.toLowerCase() === "session" || u.toLowerCase() === "sessions") {
      return `${count} ${count > 1 ? "sessions" : "session"}`;
    }
    return `${count} ${u}`;
  }
  return `${count} ${count > 1 ? "séances" : "séance"}`;
}

export function getGoalPeriodKey(period: Period, referenceDate: Date): string {
  if (period === "day") {
    return format(referenceDate, "yyyy-MM-dd");
  }
  if (period === "week") {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    return `week_${format(start, "yyyy-MM-dd")}`;
  }
  if (period === "month") {
    return `month_${format(referenceDate, "yyyy-MM")}`;
  }
  return "all";
}

export function getGoalPeriodHumanLabel(period: Period, referenceDate: Date): string {
  if (period === "day") {
    const formatted = format(referenceDate, "EEEE d MMMM yyyy", { locale: fr });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  if (period === "week") {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
    return `Semaine du ${format(start, "d MMM", { locale: fr })} au ${format(end, "d MMM yyyy", { locale: fr })}`;
  }
  if (period === "month") {
    const formatted = format(referenceDate, "MMMM yyyy", { locale: fr });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  return "Période globale";
}
