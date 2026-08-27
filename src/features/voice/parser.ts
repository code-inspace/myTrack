import { TaskFormValues } from "@/features/tasks/types";
import { format, addDays, parseISO } from "date-fns";

const FRENCH_DAY_MAP: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

/**
 * Detects a "rappelle-moi dans N minutes/heures de X" reminder phrase, in either word order
 * ("rappelle-moi dans 10 min d'acheter du pain" or "rappelle-moi d'acheter du pain dans 10 min").
 * Returns the action title and the absolute local time it resolves to relative to `now`.
 */
function parseReminderIntent(
  text: string,
  now: Date
): { title: string; startTime: string; targetDate: string } | null {
  const trimmed = text.trim();
  const durationUnit = "(heures?|h\\b|minutes?|mins?|min\\b)";

  const durationFirst = trimmed.match(
    new RegExp(`^rappelle[\\s-]*(?:moi|toi)?\\s*(?:de\\s+|d['’]\\s*)?dans\\s+(\\d+)\\s*${durationUnit}\\s*(?:de\\s+|d['’]\\s*)?(.+)$`, "i")
  );
  const actionFirst = !durationFirst
    ? trimmed.match(
        new RegExp(`^rappelle[\\s-]*(?:moi|toi)?\\s+(?:de\\s+|d['’]\\s*)?(.+?)\\s+dans\\s+(\\d+)\\s*${durationUnit}\\s*$`, "i")
      )
    : null;

  let amountStr: string | undefined;
  let unit: string | undefined;
  let actionPhrase: string | undefined;

  if (durationFirst) {
    [, amountStr, unit, actionPhrase] = durationFirst;
  } else if (actionFirst) {
    [, actionPhrase, amountStr, unit] = actionFirst;
  } else {
    return null;
  }

  const amount = parseInt(amountStr || "", 10);
  if (!amount || !actionPhrase) return null;

  const isHours = /^h/i.test(unit || "");
  const minutesFromNow = isHours ? amount * 60 : amount;

  const target = new Date(now.getTime() + minutesFromNow * 60000);
  const startTime = `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`;
  const targetDate = format(target, "yyyy-MM-dd");

  let title = actionPhrase
    .replace(/^[:,\-\s]+|[:,\-\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  title = title.length > 0 ? title.charAt(0).toUpperCase() + title.slice(1) : "Rappel";

  return { title, startTime, targetDate };
}

/**
 * Intelligent French Voice Speech-to-Tasks Parser
 * Detects multiple tasks, dates, times, categories, and recurrences from voice transcripts.
 */
export function parseVoiceTranscriptToTasks(
  transcript: string,
  referenceDateStr: string = format(new Date(), "yyyy-MM-dd")
): (TaskFormValues & { targetDate?: string })[] {
  if (!transcript || !transcript.trim()) return [];

  const rawText = transcript.trim();
  const refDate = parseISO(referenceDateStr);

  // 0. "Rappelle-moi dans N minutes/heures de X" — handled up front since "heures" here would
  // otherwise collide with the absolute clock-time heuristics below (e.g. "dans 2 heures").
  const reminder = parseReminderIntent(rawText, new Date());
  if (reminder) {
    const inferredTag = inferCategoryFromTitle(reminder.title);
    return [
      {
        title: reminder.title,
        tag: inferredTag,
        category: inferredTag,
        trackingType: "BOOLEAN",
        recurrence: "ONCE",
        startTime: reminder.startTime,
        targetDate: reminder.targetDate,
        enableReminders: true,
        reminderOffsetMinutes: 0,
      },
    ];
  }

  // 1. Split into distinct task segments by common voice separators
  const taskSeparators = /(?:nouvelle\s+t[aâ]che|nouvelle\s+action|ajoute\s+la\s+t[aâ]che|ajoute\s+une\s+t[aâ]che|ajouter\s+une\s+t[aâ]che|cr[eé]er\s+la\s+t[aâ]che|cr[eé]er\s+une\s+t[aâ]che|deuxi[eè]me\s+t[aâ]che|troisi[eè]me\s+t[aâ]che|\bet\s+aussi\b|\bet\s+puis\b)/gi;

  let rawSegments = rawText.split(taskSeparators).map((s) => s.trim()).filter((s) => s.length > 2);

  // If no separators found, treat entire transcript as one task
  if (rawSegments.length === 0) {
    rawSegments = [rawText];
  }

  const results: (TaskFormValues & { targetDate?: string })[] = [];

  for (const segment of rawSegments) {
    const parsed = parseSingleTaskSegment(segment, refDate);
    if (parsed && parsed.title.length > 1) {
      results.push(parsed);
    }
  }

  return results;
}

function parseSingleTaskSegment(
  segment: string,
  refDate: Date
): (TaskFormValues & { targetDate?: string }) | null {
  let cleaned = segment;
  let recurrence: "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM" = "ONCE";
  let recurrenceDays: number[] | undefined = undefined;
  let targetDate: string | undefined = undefined;
  let startTime: string | undefined = undefined;
  let endTime: string | undefined = undefined;

  // 1. Detect recurrence patterns (e.g. "tous les mercredis", "chaque lundi", "tous les jours", "du lundi au vendredi")
  const weeklyDayMatch = cleaned.match(/(?:tous\s+les|chaque)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?/i);
  if (weeklyDayMatch) {
    const dayName = weeklyDayMatch[1].toLowerCase();
    const dayNum = FRENCH_DAY_MAP[dayName];
    if (dayNum !== undefined) {
      recurrence = "WEEKLY";
      recurrenceDays = [dayNum];
      cleaned = cleaned.replace(weeklyDayMatch[0], "");
    }
  } else if (/tous\s+les\s+jours|chaque\s+jour|quotidien/i.test(cleaned)) {
    recurrence = "DAILY";
    cleaned = cleaned.replace(/tous\s+les\s+jours|chaque\s+jour|quotidien/gi, "");
  } else if (/du\s+lundi\s+au\s+vendredi|en\s+semaine|les\s+jours\s+ouvr[eé]s/i.test(cleaned)) {
    recurrence = "WEEKDAYS";
    cleaned = cleaned.replace(/du\s+lundi\s+au\s+vendredi|en\s+semaine|les\s+jours\s+ouvr[eé]s/gi, "");
  } else {
    // 2. Specific single date target (e.g. "mardi prochain", "demain", "après-demain", "lundi", "ce soir")
    const nextDayMatch = cleaned.match(/(?:le\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+prochain/i);
    const simpleDayMatch = cleaned.match(/(?:le\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i);

    if (nextDayMatch) {
      const dayName = nextDayMatch[1].toLowerCase();
      const targetDayNum = FRENCH_DAY_MAP[dayName];
      if (targetDayNum !== undefined) {
        targetDate = getNextDayDateString(refDate, targetDayNum, true);
        recurrence = "ONCE";
        cleaned = cleaned.replace(nextDayMatch[0], "");
      }
    } else if (simpleDayMatch && !weeklyDayMatch) {
      const dayName = simpleDayMatch[1].toLowerCase();
      const targetDayNum = FRENCH_DAY_MAP[dayName];
      if (targetDayNum !== undefined) {
        targetDate = getNextDayDateString(refDate, targetDayNum, false);
        recurrence = "ONCE";
        cleaned = cleaned.replace(simpleDayMatch[0], "");
      }
    } else if (/\bdemain\b/i.test(cleaned)) {
      targetDate = format(addDays(refDate, 1), "yyyy-MM-dd");
      recurrence = "ONCE";
      cleaned = cleaned.replace(/\bdemain\b/gi, "");
    } else if (/\bapr[eè]s[- ]demain\b/i.test(cleaned)) {
      targetDate = format(addDays(refDate, 2), "yyyy-MM-dd");
      recurrence = "ONCE";
      cleaned = cleaned.replace(/\bapr[eè]s[- ]demain\b/gi, "");
    } else if (/\baujourd['’]hui\b/i.test(cleaned)) {
      targetDate = format(refDate, "yyyy-MM-dd");
      recurrence = "ONCE";
      cleaned = cleaned.replace(/\baujourd['’]hui\b/gi, "");
    }
  }

  // 3. Detect time patterns (e.g. "à 17h", "à 17h30", "à 17 heures", "de 14h à 15h30", "à 9h")
  const timeRangeMatch = cleaned.match(/(?:de\s+)?(\d{1,2})(?:h|:\d{2}|h\d{2})\s*(?:[aà]|-)\s*(\d{1,2})(?:h|:\d{2}|h\d{2})/i);
  const singleTimeMatch = cleaned.match(/(?:[aà]\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2})|\s*heures?)/i);

  if (timeRangeMatch) {
    startTime = normalizeTimeString(timeRangeMatch[1]);
    endTime = normalizeTimeString(timeRangeMatch[2]);
    cleaned = cleaned.replace(timeRangeMatch[0], "");
  } else if (singleTimeMatch) {
    const hours = singleTimeMatch[1].padStart(2, "0");
    const minutes = (singleTimeMatch[2] || singleTimeMatch[3] || "00").padStart(2, "0");
    startTime = `${hours}:${minutes}`;
    // Auto-calculate +1h for endTime
    const endH = (parseInt(hours, 10) + 1) % 24;
    endTime = `${endH.toString().padStart(2, "0")}:${minutes}`;
    cleaned = cleaned.replace(singleTimeMatch[0], "");
  }

  // 4. Clean up remaining title text
  let title = cleaned
    .replace(/^[:,\-\s]+|[:,\-\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = "Action sans titre";
  }

  // 5. Intelligent category deduction
  const category = inferCategoryFromTitle(title);

  return {
    title,
    tag: category,
    category,
    trackingType: "BOOLEAN",
    recurrence,
    recurrenceConfig: recurrenceDays ? { days: recurrenceDays } : undefined,
    startTime,
    endTime,
    targetDate,
  };
}

function normalizeTimeString(timeStr: string): string {
  const digits = timeStr.replace(/\D/g, "");
  if (digits.length === 1 || digits.length === 2) {
    return `${digits.padStart(2, "0")}:00`;
  }
  if (digits.length === 3 || digits.length === 4) {
    const h = digits.slice(0, digits.length - 2).padStart(2, "0");
    const m = digits.slice(-2);
    return `${h}:${m}`;
  }
  return "09:00";
}

function getNextDayDateString(refDate: Date, targetDayNum: number, _forceNextWeek: boolean): string {
  const currentDay = refDate.getDay();
  let daysToAdd = (targetDayNum - currentDay + 7) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }
  return format(addDays(refDate, daysToAdd), "yyyy-MM-dd");
}

function inferCategoryFromTitle(title: string): string {
  const lower = title.toLowerCase();
  if (/sport|musculation|course|courir|gym|pompes|abdos|danse|fitness|entraînement|piscine|vélo/i.test(lower)) {
    return "Sport";
  }
  if (/méditer|méditation|eau|boire|sommeil|dormir|santé|vitamines|étirements/i.test(lower)) {
    return "Santé";
  }
  if (/email|mail|réunion|client|call|projet|rapport|travail|bureau|code|facture/i.test(lower)) {
    return "Travail";
  }
  if (/lire|lecture|livre|apprendre|cours|anglais|formation|étude/i.test(lower)) {
    return "Apprentissage";
  }
  return "General";
}

// ---------------------------------------------------------------------------
// Voice actions beyond "create a task": closing/completing an existing one.
// ---------------------------------------------------------------------------

// Requires the literal word "tâche" so an ordinary new-task phrase like "Termine le rapport"
// isn't mistaken for a close command — the same verbs are common in task titles on their own.
const CLOSE_TASK_REGEX =
  /^(?:ferme|fermer|termine|terminer|marque|coche|cocher)\s+(?:cette\s+|la\s+)?t[aâ]che\s+(.+?)(?:\s+comme\s+(?:fait[e]?|termin[eé]e?|compl[eè]t[eé]e?))?\s*$/i;

export interface CreateTaskAction {
  kind: "create";
  task: TaskFormValues & { targetDate?: string };
}

export interface CompleteTaskAction {
  kind: "complete";
  /** Raw spoken task title to fuzzy-match against the user's existing tasks. */
  query: string;
}

export type VoiceAction = CreateTaskAction | CompleteTaskAction;

/**
 * Entry point covering both intents: creating new tasks (the original behavior) and closing an
 * existing one ("ferme/termine la tâche X"). Falls back to task creation when nothing matches.
 */
export function parseVoiceTranscriptToActions(
  transcript: string,
  referenceDateStr: string = format(new Date(), "yyyy-MM-dd")
): VoiceAction[] {
  if (!transcript || !transcript.trim()) return [];

  const closeMatch = transcript.trim().match(CLOSE_TASK_REGEX);
  if (closeMatch?.[1] && closeMatch[1].trim().length > 1) {
    return [{ kind: "complete", query: closeMatch[1].trim() }];
  }

  return parseVoiceTranscriptToTasks(transcript, referenceDateStr).map((task) => ({
    kind: "create" as const,
    task,
  }));
}

/**
 * Fuzzy-matches a spoken task title against the user's existing tasks: exact match first, then
 * substring containment, then best word-overlap.
 */
export function findBestMatchingTask<T extends { id: string; title: string }>(
  query: string,
  tasks: T[]
): T | null {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const normQuery = normalize(query);
  if (!normQuery) return null;

  const exact = tasks.find((t) => normalize(t.title) === normQuery);
  if (exact) return exact;

  const contains = tasks.find((t) => {
    const nt = normalize(t.title);
    return nt.length > 0 && (nt.includes(normQuery) || normQuery.includes(nt));
  });
  if (contains) return contains;

  const queryWords = new Set(normQuery.split(/\s+/).filter(Boolean));
  let best: T | null = null;
  let bestScore = 0;
  for (const t of tasks) {
    const words = normalize(t.title).split(/\s+/).filter(Boolean);
    const overlap = words.filter((w) => queryWords.has(w)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = t;
    }
  }
  return best;
}
