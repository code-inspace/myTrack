import type { PlanBlock, RunItem } from "./types";

export const MIN_BLOCK_MINUTES = 5;
export const MINUTE_MS = 60_000;

const PRIORITY_RANK: Record<string, number> = { VERY_URGENT: 0, URGENT: 1, NORMAL: 2 };

export interface BreakSettings {
  enabled: boolean;
  minutes: number;
}

export function planTotals(blocks: PlanBlock[], breaks: BreakSettings, availableMinutes: number) {
  const workMinutes = blocks.reduce((sum, b) => sum + b.minutes, 0);
  const breakMinutes = breaks.enabled && blocks.length > 1 ? breaks.minutes * (blocks.length - 1) : 0;
  const plannedMinutes = workMinutes + breakMinutes;
  return {
    workMinutes,
    breakMinutes,
    plannedMinutes,
    availableMinutes,
    /** Positive: time left over. Negative: the plan doesn't fit. */
    freeMinutes: availableMinutes - plannedMinutes,
  };
}

/** Tasks (and, if enabled, breaks between them) as the items the session will run. */
export function buildItems(blocks: PlanBlock[], breaks: BreakSettings, idFactory: () => string): RunItem[] {
  const items: RunItem[] = [];
  blocks.forEach((block, i) => {
    if (i > 0 && breaks.enabled && breaks.minutes > 0) {
      items.push({
        id: idFactory(),
        kind: "break",
        taskId: null,
        title: "Pause",
        color: null,
        recurring: false,
        plannedMs: breaks.minutes * MINUTE_MS,
        startedAtMs: null,
        endsAtMs: null,
        pausedMs: 0,
        actualMs: 0,
        state: "pending",
      });
    }
    items.push({
      id: block.id,
      kind: "task",
      taskId: block.taskId,
      title: block.title,
      color: block.color ?? null,
      recurring: Boolean(block.recurring),
      plannedMs: block.minutes * MINUTE_MS,
      startedAtMs: null,
      endsAtMs: null,
      pausedMs: 0,
      actualMs: 0,
      state: "pending",
    });
  });
  return items;
}

/** Planned slots for a preview: where each item would start/end if the session starts at `startMs`. */
export function previewTimeline(items: RunItem[], startMs: number) {
  let cursor = startMs;
  return items.map((item) => {
    const slot = { item, startMs: cursor, endMs: cursor + item.plannedMs };
    cursor += item.plannedMs;
    return slot;
  });
}

export interface OrderSuggestion {
  blocks: PlanBlock[];
  /** Why each block sits where it does, by block id */
  reasons: Record<string, string>;
}

/**
 * A readable rule, not a black box: pinned blocks first (in their current order), then by
 * priority, then nearest deadline, then the longer block first (heavier work while fresh).
 */
export function suggestOrder(blocks: PlanBlock[]): OrderSuggestion {
  const reasons: Record<string, string> = {};
  const indexed = blocks.map((b, i) => ({ b, i }));

  indexed.sort((x, y) => {
    if (Boolean(x.b.pinned) !== Boolean(y.b.pinned)) return x.b.pinned ? -1 : 1;
    if (x.b.pinned && y.b.pinned) return x.i - y.i;
    const px = PRIORITY_RANK[x.b.priority || "NORMAL"] ?? 2;
    const py = PRIORITY_RANK[y.b.priority || "NORMAL"] ?? 2;
    if (px !== py) return px - py;
    const dx = x.b.deadline || "9999-12-31";
    const dy = y.b.deadline || "9999-12-31";
    if (dx !== dy) return dx < dy ? -1 : 1;
    if (x.b.minutes !== y.b.minutes) return y.b.minutes - x.b.minutes;
    return x.i - y.i;
  });

  const ordered = indexed.map((e) => e.b);
  ordered.forEach((b, position) => {
    if (b.pinned) reasons[b.id] = "Épinglée : elle garde sa place";
    else if (b.priority === "VERY_URGENT") reasons[b.id] = "Très urgente";
    else if (b.priority === "URGENT") reasons[b.id] = "Urgente";
    else if (b.deadline) reasons[b.id] = `Échéance le ${b.deadline.split("-").reverse().join("/")}`;
    else if (position === 0) reasons[b.id] = "Le plus long bloc d'abord, pendant que tu es frais";
    else reasons[b.id] = "Pas d'urgence : placée selon sa durée";
  });
  return { blocks: ordered, reasons };
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "1h30", "45 min" */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, "0")}`;
}

/** "12:05" / "1:02:05" for the big countdown (negative = overtime, shown without sign) */
export function formatCountdown(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
