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
 * Bridge TypeScript sécurisé pour piloter les Live Activities (Dynamic Island & Lock Screen)
 * sans dépendance externe bloquante.
 */
export const LiveActivityBridge = {
  isSupported(): boolean {
    return Capacitor.getPlatform() === "ios";
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

      // 1. Envoyer à l'interface native WKWebView si disponible
      if (typeof window !== "undefined") {
        const webkit = (window as any).webkit;
        if (webkit?.messageHandlers?.liveActivityStart) {
          webkit.messageHandlers.liveActivityStart.postMessage(payload);
        }
        // Stocker l'état pour les widgets partagés (App Group / localStorage)
        localStorage.setItem("mytrack_active_live_activity", JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("mytrack:live-activity-start", { detail: payload }));
      }
      return attributes.taskId;
    } catch (err) {
      console.warn("[LiveActivity] startActivity safe note:", err);
      return null;
    }
  },

  async updateActivity(activityId: string, updatedState: Partial<TaskActivityState>): Promise<void> {
    if (!this.isSupported()) return;

    try {
      if (typeof window !== "undefined") {
        const webkit = (window as any).webkit;
        if (webkit?.messageHandlers?.liveActivityUpdate) {
          webkit.messageHandlers.liveActivityUpdate.postMessage({ activityId, ...updatedState });
        }
        window.dispatchEvent(
          new CustomEvent("mytrack:live-activity-update", { detail: { activityId, ...updatedState } })
        );
      }
    } catch (err) {
      console.warn("[LiveActivity] updateActivity safe note:", err);
    }
  },

  async stopActivity(activityId: string): Promise<void> {
    if (!this.isSupported()) return;

    try {
      if (typeof window !== "undefined") {
        const webkit = (window as any).webkit;
        if (webkit?.messageHandlers?.liveActivityStop) {
          webkit.messageHandlers.liveActivityStop.postMessage({ activityId });
        }
        localStorage.removeItem("mytrack_active_live_activity");
        window.dispatchEvent(new CustomEvent("mytrack:live-activity-stop", { detail: { activityId } }));
      }
    } catch (err) {
      console.warn("[LiveActivity] stopActivity safe note:", err);
    }
  },
};
