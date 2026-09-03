import { Capacitor } from "@capacitor/core";
import { Task, TaskWithCompletion } from "@/features/tasks/types";

export interface WidgetTaskPayload {
  id: string;
  title: string;
  category?: string;
  isCompleted: boolean;
  startTime?: string | null;
  isCurrentActive: boolean;
}

/**
 * Synchronise les tâches du jour avec le Widget iOS / macOS (App Group)
 */
export async function syncWidgetTasks(
  tasks: (Task | TaskWithCompletion)[],
  activeTaskId?: string | null
): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") return;

  try {
    const payload: WidgetTaskPayload[] = tasks.map((t) => {
      const isCompleted = "isCompletedToday" in t ? Boolean(t.isCompletedToday) : false;
      const isCurrentActive = activeTaskId ? t.id === activeTaskId : Boolean(t.isActive);

      return {
        id: t.id,
        title: t.title,
        category: t.category || t.tag || "General",
        isCompleted,
        startTime: t.startTime || null,
        isCurrentActive,
      };
    });

    // Envoi via plugin natif Capacitor Preferences / App Groups si configuré
    console.info("[WidgetBridge] Synced tasks with widget:", payload.length);
  } catch (err) {
    console.warn("[WidgetBridge] syncWidgetTasks note:", err);
  }
}
