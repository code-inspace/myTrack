import { Capacitor } from "@capacitor/core";

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

/**
 * Bridge TypeScript pour démarrer / mettre à jour / arrêter une Live Activity
 * sur iOS (Lock Screen & Dynamic Island).
 */
export const LiveActivityBridge = {
  isSupported(): boolean {
    return Capacitor.getPlatform() === "ios";
  },

  async startActivity(attributes: TaskActivityAttributes, initialState: TaskActivityState): Promise<string | null> {
    if (!this.isSupported()) {
      console.info("[LiveActivity] Ignored: Not running on iOS native platform");
      return null;
    }

    try {
      // @ts-ignore
      const { LiveActivity } = await import("@capgo/capacitor-live-activity");
      const res = await LiveActivity.start({
        activityName: "TaskTimerActivity",
        data: {
          ...attributes,
          ...initialState,
        },
      });
      return res?.activityId || "started";
    } catch (err) {
      console.warn("[LiveActivity] startActivity error:", err);
      return null;
    }
  },

  async updateActivity(activityId: string, updatedState: Partial<TaskActivityState>): Promise<void> {
    if (!this.isSupported()) return;

    try {
      // @ts-ignore
      const { LiveActivity } = await import("@capgo/capacitor-live-activity");
      await LiveActivity.update({
        activityId,
        data: updatedState,
      });
    } catch (err) {
      console.warn("[LiveActivity] updateActivity error:", err);
    }
  },

  async stopActivity(activityId: string): Promise<void> {
    if (!this.isSupported()) return;

    try {
      // @ts-ignore
      const { LiveActivity } = await import("@capgo/capacitor-live-activity");
      await LiveActivity.stop({
        activityId,
      });
    } catch (err) {
      console.warn("[LiveActivity] stopActivity error:", err);
    }
  },
};
