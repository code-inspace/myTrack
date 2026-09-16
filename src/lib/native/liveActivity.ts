import { Capacitor, registerPlugin } from "@capacitor/core";

export interface TaskActivityAttributes {
  taskId: string;
  taskTitle: string;
  category?: string;
}

export interface TaskActivityState {
  currentStatus: "IN_PROGRESS" | "PAUSED" | "COMPLETED";
  startedAtTimestamp: number;
  elapsedSeconds: number;
  targetDurationSeconds?: number;
  totalFormattedDuration?: string;
  subtitle?: string;
  progress?: number;
}

export interface ActiveTaskBridgeModel {
  taskId: string;
  taskTitle: string;
  category?: string;
  subtitle?: string;
  startedAtTimestamp?: number;
  totalFormattedDuration?: string;
}

interface LiveActivityPluginInterface {
  startActivity(options: any): Promise<{ activityId?: string; taskId?: string }>;
  updateActivity(options: any): Promise<{ success: boolean }>;
  stopActivity(options: any): Promise<{ success: boolean }>;
  getActiveTask(): Promise<{
    hasActiveTask: boolean;
    task: ActiveTaskBridgeModel | null;
    activeTasks?: ActiveTaskBridgeModel[];
    lastStoppedTaskId?: string | null;
  }>;
  syncTasks(options: { tasks: any[]; activeTask?: any; activeTasks?: any[] }): Promise<{ success: boolean }>;
  syncStandby(options: {
    enabled: boolean;
    nextTaskId?: string;
    nextTaskTitle?: string;
    nextTaskCategory?: string;
  }): Promise<{ success: boolean }>;
  syncSleepMode(options: {
    isActive: boolean;
    bedtime: string;
    wakeTime?: string;
    phaseIndex?: number;
    startedAtTimestamp?: number;
    sessions?: Array<{
      id: string;
      phaseIndex: number;
      startTime: string;
      endTime?: string | null;
      timestamp: number;
    }>;
  }): Promise<{ success: boolean }>;
  checkAuthorization(): Promise<{ enabled: boolean; frequentUpdatesEnabled: boolean; supported: boolean; reason?: string }>;
  openSettings(): Promise<{ success: boolean }>;
}

const NativeLiveActivity = registerPlugin<LiveActivityPluginInterface>("LiveActivityPlugin");

/**
 * Bridge TypeScript pour démarrer / mettre à jour / arrêter une Live Activity
 * sur iOS (Lock Screen & Dynamic Island).
 */
export const LiveActivityBridge = {
  isSupported(): boolean {
    return Capacitor.isNativePlatform() || Capacitor.getPlatform() === "ios";
  },

  async checkAuthorization(): Promise<{ enabled: boolean; frequentUpdatesEnabled: boolean; supported: boolean; reason?: string }> {
    if (!this.isSupported()) {
      return { enabled: false, frequentUpdatesEnabled: false, supported: false, reason: "Non supporté sur cette plateforme" };
    }
    try {
      return await NativeLiveActivity.checkAuthorization();
    } catch (err: any) {
      return { enabled: false, frequentUpdatesEnabled: false, supported: true, reason: err?.message };
    }
  },

  async openSettings(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const res = await NativeLiveActivity.openSettings();
      return res?.success ?? true;
    } catch {
      return false;
    }
  },

  async startActivity(attributes: TaskActivityAttributes, initialState: TaskActivityState): Promise<string | null> {
    if (!this.isSupported()) {
      return null;
    }

    try {
      const payload = {
        ...attributes,
        ...initialState,
      };

      // 1. Déclencher le plugin natif Swift Capacitor
      try {
        const res = await NativeLiveActivity.startActivity(payload);
        console.log("[LiveActivityBridge] Native activity / widget updated:", res);
      } catch (nativeErr: any) {
        console.warn("[LiveActivityBridge] Native call note:", nativeErr);
      }

      // 2. Stocker l'état pour les widgets partagés (App Group / localStorage)
      if (typeof window !== "undefined") {
        localStorage.setItem("mytrack_active_live_activity", JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("mytrack:live-activity-start", { detail: payload }));
      }

      return attributes.taskId;
    } catch (err) {
      console.warn("[LiveActivity] startActivity error:", err);
      return null;
    }
  },

  async updateActivity(activityId: string, updatedState: Partial<TaskActivityState>): Promise<void> {
    if (!this.isSupported()) return;

    try {
      try {
        await NativeLiveActivity.updateActivity({ activityId, taskId: activityId, ...updatedState });
      } catch {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mytrack:live-activity-update", { detail: { activityId, ...updatedState } })
        );
      }
    } catch (err) {
      console.warn("[LiveActivity] updateActivity error:", err);
    }
  },

  async stopActivity(activityId: string): Promise<void> {
    if (!this.isSupported()) return;

    try {
      try {
        await NativeLiveActivity.stopActivity({ activityId, taskId: activityId });
      } catch {}

      if (typeof window !== "undefined") {
        localStorage.removeItem("mytrack_active_live_activity");
        window.dispatchEvent(new CustomEvent("mytrack:live-activity-stop", { detail: { activityId } }));
      }
    } catch (err) {
      console.warn("[LiveActivity] stopActivity error:", err);
    }
  },

  async getActiveTask(): Promise<{
    hasActiveTask: boolean;
    task: ActiveTaskBridgeModel | null;
    activeTasks?: ActiveTaskBridgeModel[];
    lastStoppedTaskId?: string | null;
  }> {
    if (!this.isSupported()) {
      return { hasActiveTask: false, task: null, activeTasks: [], lastStoppedTaskId: null };
    }
    try {
      const res = await NativeLiveActivity.getActiveTask();
      return res || { hasActiveTask: false, task: null, activeTasks: [], lastStoppedTaskId: null };
    } catch {
      return { hasActiveTask: false, task: null, activeTasks: [], lastStoppedTaskId: null };
    }
  },

  async syncTasks(
    tasks: any[],
    activeTask?: ActiveTaskBridgeModel | null,
    activeTasks?: ActiveTaskBridgeModel[]
  ): Promise<void> {
    if (!this.isSupported() || !Array.isArray(tasks)) return;

    try {
      const widgetTasks = tasks.map((t: any) => ({
        id: t.id,
        title: t.title || "Tâche",
        category: t.category || t.calendarName || t.tag || "myTrack",
        subtitle: t.subtitle || t.description || t.category || "Routine",
        targetFormattedDuration:
          t.targetFormattedDuration ||
          (t.targetValue ? `${t.targetValue} ${t.unit || "min"}` : undefined),
        isHabit: t.isHabit ?? false,
        color: t.projectColor || t.color || t.calendarColor || "#D4F63D",
        projectColor: t.projectColor || null,
        projectName: t.projectName || null,
        isCompleted: Boolean(
          t.isCompletedToday || t.completion?.completed || t.isCompleted
        ),
      }));

      await NativeLiveActivity.syncTasks({
        tasks: widgetTasks,
        activeTask: activeTask ?? null,
        activeTasks: activeTasks ?? (activeTask ? [activeTask] : []),
      });
    } catch (err) {
      console.warn("[LiveActivity] syncTasks error:", err);
    }
  },

  async syncStandby(nextTask: any | null, enabled: boolean): Promise<void> {
    if (!this.isSupported()) return;

    try {
      await NativeLiveActivity.syncStandby({
        enabled,
        nextTaskId: nextTask?.id || undefined,
        nextTaskTitle: nextTask?.title || undefined,
        nextTaskCategory: nextTask?.tag || nextTask?.category || undefined,
      });
    } catch (err) {
      console.warn("[LiveActivity] syncStandby error:", err);
    }
  },

  async syncSleepMode(options: {
    isActive: boolean;
    bedtime: string;
    wakeTime?: string;
    phaseIndex?: number;
    startedAtTimestamp?: number;
    sessions?: Array<{
      id: string;
      phaseIndex: number;
      startTime: string;
      endTime?: string | null;
      timestamp: number;
    }>;
  }): Promise<void> {
    if (!this.isSupported()) return;

    try {
      await NativeLiveActivity.syncSleepMode(options);
    } catch (err) {
      console.warn("[LiveActivity] syncSleepMode error:", err);
    }
  },
};
