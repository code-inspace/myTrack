import { Goal, GoalProgressResult, formatMinutesToHours, formatCountUnit } from "./types";
import { Period } from "@/features/dashboard/types";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { getEffectiveUserId } from "@/features/tasks/actions";
import { createClient } from "@/utils/supabase/client";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

const GOALS_STORAGE_PREFIX = "mytrack_goals_";

export function getStoredGoals(userId?: string): Goal[] {
  if (typeof window === "undefined") return [];
  const targetId = getEffectiveUserId(userId);
  const key = GOALS_STORAGE_PREFIX + targetId;

  let stored = localStorage.getItem(key);
  if (!stored) {
    stored = localStorage.getItem("mytrack_cached_goals") || localStorage.getItem(GOALS_STORAGE_PREFIX);
  }
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredGoals(goals: Goal[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const serialized = JSON.stringify(goals);
  localStorage.setItem(GOALS_STORAGE_PREFIX + targetId, serialized);
  localStorage.setItem("mytrack_cached_goals", serialized);
}

export async function fetchGoals(userId?: string): Promise<Goal[]> {
  const targetId = getEffectiveUserId(userId);

  // 1. Essayer l'API route serveur
  try {
    const res = await fetch(`/api/goals?userId=${encodeURIComponent(targetId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.goals)) {
        saveStoredGoals(json.goals, targetId);
        return json.goals;
      }
    }
  } catch (apiErr) {
    console.warn("fetchGoals API route error, falling back to local storage:", apiErr);
  }

  // 2. Fallback Supabase client
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: Goal[] = data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        projectId: row.project_id,
        projectCategory: row.project_category || undefined,
        projectCategories: Array.isArray(row.project_categories)
          ? row.project_categories
          : row.project_category
          ? [row.project_category]
          : undefined,
        periodType: row.period_type || "week",
        periodKey: row.period_key || undefined,
        isRecurring: row.is_recurring !== undefined ? Boolean(row.is_recurring) : (row.isRecurring !== undefined ? Boolean(row.isRecurring) : true),
        targetType: row.target_type || "duration",
        targetMinutes: Number(row.target_minutes) || 60,
        targetCount: row.target_count ? Number(row.target_count) : undefined,
        unit: row.unit || undefined,
        color: row.color || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      }));
      saveStoredGoals(mapped, targetId);
      return mapped;
    }
  } catch {}

  return getStoredGoals(targetId);
}

export async function createDbGoal(
  payload: Omit<Goal, "id" | "createdAt" | "updatedAt" | "userId"> & { userId?: string },
  userId?: string
): Promise<Goal> {
  const targetId = getEffectiveUserId(userId || payload.userId);
  const nowIso = new Date().toISOString();
  const tempId = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newGoal: Goal = {
    ...payload,
    id: tempId,
    userId: targetId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. Sauvegarde locale synchrone immédiate
  const current = getStoredGoals(targetId);
  const updated = [newGoal, ...current.filter((g) => g.id !== tempId)];
  saveStoredGoals(updated, targetId);

  // 2. Persistance distante
  try {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newGoal),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.goal?.id) {
        const persisted = json.goal;
        const finalized = updated.map((g) => (g.id === tempId ? persisted : g));
        saveStoredGoals(finalized, targetId);
        return persisted;
      }
    }
  } catch (err) {
    console.warn("createDbGoal API sync error:", err);
  }

  return newGoal;
}

export async function updateDbGoal(
  id: string,
  updates: Partial<Omit<Goal, "id" | "userId" | "createdAt">>,
  userId?: string
): Promise<Goal> {
  const targetId = getEffectiveUserId(userId);
  const nowIso = new Date().toISOString();

  const current = getStoredGoals(targetId);
  const existing = current.find((g) => g.id === id);
  if (!existing) {
    throw new Error("Objectif introuvable");
  }

  const updatedGoal: Goal = {
    ...existing,
    ...updates,
    updatedAt: nowIso,
  };

  const updated = current.map((g) => (g.id === id ? updatedGoal : g));
  saveStoredGoals(updated, targetId);

  try {
    await fetch(`/api/goals`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates, userId: targetId }),
    });
  } catch (err) {
    console.warn("updateDbGoal API error:", err);
  }

  return updatedGoal;
}

export async function deleteDbGoal(id: string, userId?: string): Promise<void> {
  const targetId = getEffectiveUserId(userId);

  const current = getStoredGoals(targetId);
  const updated = current.filter((g) => g.id !== id);
  saveStoredGoals(updated, targetId);

  try {
    await fetch(`/api/goals?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(targetId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("deleteDbGoal API error:", err);
  }
}

/**
 * Calcule la durée effective réalisée pour un objectif donné
 * selon la période ("day" | "week" | "month") et la date de référence.
 */
export function computeGoalProgress(params: {
  goal: Goal;
  period: Period;
  referenceDate: Date;
  tasks: Task[];
  completions: TaskCompletion[];
  externalEvents?: ExternalCalendarEvent[];
}): GoalProgressResult {
  const { goal, period, referenceDate, tasks, completions, externalEvents = [] } = params;

  // 1. Définir la plage de dates
  let startDateStr = format(referenceDate, "yyyy-MM-dd");
  let endDateStr = startDateStr;

  if (period === "week") {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
    startDateStr = format(start, "yyyy-MM-dd");
    endDateStr = format(end, "yyyy-MM-dd");
  } else if (period === "month") {
    const start = startOfMonth(referenceDate);
    const end = endOfMonth(referenceDate);
    startDateStr = format(start, "yyyy-MM-dd");
    endDateStr = format(end, "yyyy-MM-dd");
  }

  // 2. Définir les sous-projets ciblés
  const targetCategories: string[] =
    goal.projectCategories && goal.projectCategories.length > 0
      ? goal.projectCategories
      : goal.projectCategory
      ? [goal.projectCategory]
      : [];

  const matchesCategoryOrTitle = (targetCat: string, t: Task) => {
    const normTarget = targetCat.trim().toLowerCase();
    if (!normTarget) return false;

    // 1. Explicit projectCategory or dateOverrides
    const explicitCat = (t.projectCategory || t.dateOverrides?._projectCategory || "")
      .trim()
      .toLowerCase();
    if (explicitCat) {
      if (
        explicitCat === normTarget ||
        explicitCat.includes(normTarget) ||
        normTarget.includes(explicitCat)
      ) {
        return true;
      }
    }

    // 2. Tag or category
    const tag = (t.tag || "").trim().toLowerCase();
    if (tag && tag !== "general") {
      if (tag === normTarget || tag.includes(normTarget) || normTarget.includes(tag)) {
        return true;
      }
    }

    const category = (t.category || "").trim().toLowerCase();
    if (category && category !== "general") {
      if (category === normTarget || category.includes(normTarget) || normTarget.includes(category)) {
        return true;
      }
    }

    // 3. Task title matching (e.g. "Sport : bas du corps" contains "bas", "Sport : abdos" contains "abdos")
    const title = (t.title || "").trim().toLowerCase();
    if (title) {
      if (title === normTarget || title.includes(normTarget)) {
        return true;
      }
      const singularTarget = normTarget.endsWith("s") ? normTarget.slice(0, -1) : normTarget;
      if (singularTarget.length >= 3 && title.includes(singularTarget)) {
        return true;
      }
    }

    return false;
  };

  // Filtrer les tâches correspondant au projet et aux sous-projets ciblés de l'objectif
  const matchingTasks = tasks.filter((t) => {
    if (t.projectId !== goal.projectId) return false;
    if (targetCategories.length > 0) {
      return targetCategories.some((targetCat) => matchesCategoryOrTitle(targetCat, t));
    }
    return true;
  });

  const matchingTaskIds = new Set(matchingTasks.map((t) => t.id));

  // 3. Calculer les minutes effectives
  let totalMinutes = 0;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isTodayInPeriod = todayStr >= startDateStr && todayStr <= endDateStr;

  // A. Complétions enregistrées dans l'intervalle
  const periodCompletions = completions.filter(
    (c) =>
      matchingTaskIds.has(c.taskId) &&
      c.date >= startDateStr &&
      c.date <= endDateStr
  );

  for (const c of periodCompletions) {
    const matchingTask = matchingTasks.find((t) => t.id === c.taskId);
    if (!matchingTask) continue;

    if (c.completed) {
      let sessionMinutes = 0;
      if (c.actualStartTime && c.actualEndTime) {
        const [h1, m1] = c.actualStartTime.split(":").map(Number);
        const [h2, m2] = c.actualEndTime.split(":").map(Number);
        let diff = h2 * 60 + m2 - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        if (diff > 0) {
          sessionMinutes = typeof c.duration === "number" && c.duration > diff ? c.duration : diff;
        }
      }
      if (sessionMinutes === 0 && typeof c.duration === "number" && c.duration > 0) {
        sessionMinutes = c.duration;
      }
      if (sessionMinutes === 0 && matchingTask.startTime && matchingTask.endTime) {
        const [h1, m1] = matchingTask.startTime.split(":").map(Number);
        const [h2, m2] = matchingTask.endTime.split(":").map(Number);
        let diff = h2 * 60 + m2 - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        if (diff > 0) sessionMinutes = diff;
      }
      if (sessionMinutes === 0 && matchingTask.targetValue) {
        sessionMinutes = Number(matchingTask.targetValue) || 30;
      }
      if (sessionMinutes === 0) {
        sessionMinutes = 30;
      }
      totalMinutes += sessionMinutes;
    }
  }

  // B. Tâches actuellement ACTIVES (chronomètre en cours démarré)
  if (isTodayInPeriod) {
    for (const t of matchingTasks) {
      if (t.isActive && t.startedAt) {
        const startTimestamp = new Date(t.startedAt).getTime();
        if (!isNaN(startTimestamp)) {
          const nowMs = Date.now();
          const elapsedMinutes = Math.max(1, Math.floor((nowMs - startTimestamp) / 60000));
          totalMinutes += elapsedMinutes;
        }
      }
    }
  }

  // C. Tâches non récurrentes marquées terminées sans completion explicite mais avec projectStatus === 'DONE'
  for (const t of matchingTasks) {
    const isRecurring = t.recurrence && t.recurrence !== "ONCE";
    if (t.projectStatus === "DONE" && !t.isActive && !isRecurring) {
      const hasComp = periodCompletions.some((c) => c.taskId === t.id && c.completed);
      if (!hasComp) {
        const taskDate = (t as any).date || t.deadline || (t.createdAt ? t.createdAt.split("T")[0] : null);
        if (taskDate && taskDate >= startDateStr && taskDate <= endDateStr) {
          totalMinutes += Number(t.targetValue) || 30;
        }
      }
    }
  }

  // D. Filtrer et ajouter les événements de calendrier externes associés au projet/sous-projet
  const matchingEvents = externalEvents.filter((e) => {
    if (e.projectId !== goal.projectId) return false;
    if (targetCategories.length > 0) {
      return targetCategories.some((targetCat) => {
        const normTarget = targetCat.trim().toLowerCase();
        const cat = (e.projectCategory || e.calendarName || "").trim().toLowerCase();
        const title = (e.title || "").trim().toLowerCase();
        if (cat && (cat === normTarget || cat.includes(normTarget) || normTarget.includes(cat))) {
          return true;
        }
        if (title && (title === normTarget || title.includes(normTarget))) {
          return true;
        }
        const singularTarget = normTarget.endsWith("s") ? normTarget.slice(0, -1) : normTarget;
        if (singularTarget.length >= 3 && (cat.includes(singularTarget) || title.includes(singularTarget))) {
          return true;
        }
        return false;
      });
    }
    return e.date >= startDateStr && e.date <= endDateStr;
  });

  for (const evt of matchingEvents) {
    if (evt.startTime && evt.endTime) {
      const [sH, sM] = evt.startTime.split(":").map(Number);
      const [eH, eM] = evt.endTime.split(":").map(Number);
      if (!isNaN(sH) && !isNaN(eH)) {
        let diff = eH * 60 + eM - (sH * 60 + sM);
        if (diff < 0) diff += 24 * 60;
        totalMinutes += diff;
      }
    } else {
      totalMinutes += 60;
    }
  }

  // Calculate total sessions / count for count-based goals
  let totalCount = 0;
  // Completed completions in the period
  totalCount += periodCompletions.filter((c) => c.completed).length;

  // Completed non-recurring tasks marked DONE without a completion row in the period
  for (const t of matchingTasks) {
    const isRecurring = t.recurrence && t.recurrence !== "ONCE";
    if (t.projectStatus === "DONE" && !t.isActive && !isRecurring) {
      const hasComp = periodCompletions.some((c) => c.taskId === t.id && c.completed);
      if (!hasComp) {
        const taskDate = (t as any).date || t.deadline || (t.createdAt ? t.createdAt.split("T")[0] : null);
        if (taskDate && taskDate >= startDateStr && taskDate <= endDateStr) {
          totalCount += 1;
        }
      }
    }
  }

  // External calendar events matched
  totalCount += matchingEvents.length;

  const isCountGoal = goal.targetType === "count";

  if (isCountGoal) {
    const targetCount = Math.max(1, goal.targetCount || 1);
    const percentage = Math.round((totalCount / targetCount) * 100);
    const isCompleted = totalCount >= targetCount;
    const isOverachieved = totalCount > targetCount;
    const remainingCount = Math.max(0, targetCount - totalCount);

    return {
      targetType: "count",
      actualMinutes: totalMinutes,
      targetMinutes: goal.targetMinutes || 0,
      actualCount: totalCount,
      targetCount,
      percentage,
      isCompleted,
      isOverachieved,
      formattedActual: formatCountUnit(totalCount, goal.unit),
      formattedTarget: formatCountUnit(targetCount, goal.unit),
      formattedRemaining: formatCountUnit(remainingCount, goal.unit),
    };
  }

  const targetMinutes = Math.max(1, goal.targetMinutes);
  const percentage = Math.round((totalMinutes / targetMinutes) * 100);
  const isCompleted = totalMinutes >= targetMinutes;
  const isOverachieved = totalMinutes > targetMinutes;
  const remainingMinutes = Math.max(0, targetMinutes - totalMinutes);

  return {
    targetType: "duration",
    actualMinutes: totalMinutes,
    targetMinutes,
    actualCount: totalCount,
    targetCount: goal.targetCount,
    percentage,
    isCompleted,
    isOverachieved,
    formattedActual: formatMinutesToHours(totalMinutes),
    formattedTarget: formatMinutesToHours(targetMinutes),
    formattedRemaining: formatMinutesToHours(remainingMinutes),
  };
}
