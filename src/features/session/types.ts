/** A task the user wants to work on during the session, with the time they give it. */
export interface PlanBlock {
  id: string;
  /** Existing task, or null for a task that will be created when the session starts */
  taskId: string | null;
  title: string;
  minutes: number;
  color?: string | null;
  priority?: string | null;
  /** YYYY-MM-DD */
  deadline?: string | null;
  projectId?: string | null;
  projectCategory?: string | null;
  /** Recurring tasks are rescheduled for today only, one-off tasks are moved */
  recurring?: boolean;
  /** Pinned blocks keep their place when an order is suggested */
  pinned?: boolean;
}

export type RunItemKind = "task" | "break";
export type RunItemState = "pending" | "active" | "done" | "skipped";

export interface RunItem {
  id: string;
  kind: RunItemKind;
  taskId: string | null;
  title: string;
  color: string | null;
  recurring: boolean;
  /** Current planned length (extended / shrunk during the session) */
  plannedMs: number;
  startedAtMs: number | null;
  /** Absolute end, so the countdown survives a locked screen or a reload */
  endsAtMs: number | null;
  /** Time spent paused while this item was active */
  pausedMs: number;
  actualMs: number;
  state: RunItemState;
}

export interface SessionState {
  id: string;
  createdAtMs: number;
  /** The end the user asked for (start + available time), moved by "décaler la fin" */
  sessionEndMs: number;
  items: RunItem[];
  index: number;
  paused: boolean;
  pausedAtMs: number | null;
  status: "running" | "finished" | "cancelled";
}
