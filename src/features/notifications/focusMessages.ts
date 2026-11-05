import { goalsVerdict, type GoalInsightItem } from "@/features/bilan/insights";
import { formatMinutes } from "@/features/session/plan";

export interface FocusInput {
  items: GoalInsightItem[];
  /** Minutes worked today, all projects */
  todayMinutes: number;
  /** 0 = Sunday */
  weekday: number;
}

export interface FocusMessage {
  title: string;
  body: string;
}

/** Morning: the one thing worth doing. Null when there is no goal (the caller keeps its default text). */
export function morningFocusMessage({ items }: FocusInput): FocusMessage | null {
  if (items.length === 0) return null;
  const verdict = goalsVerdict(items);
  if (verdict.focus) {
    const { name, remainingMinutes, suggestedMinutes, behind } = verdict.focus;
    return {
      title: behind ? "Tu es en retard sur un objectif" : "Ton focus du jour",
      body: `Il te manque ${formatMinutes(remainingMinutes)} sur « ${name} » cette semaine. ${suggestedMinutes} min maintenant ?`,
    };
  }
  if (verdict.done === verdict.total) {
    return { title: "Objectifs de la semaine atteints", body: "Tout est dans le vert. Profite, ou avance sur la semaine prochaine." };
  }
  return { title: "Ton focus du jour", body: "Tu es dans le rythme sur tes objectifs. Continue comme ça." };
}

/** Evening: what happened today; on Sunday, the verdict of the week. */
export function eveningFocusMessage(input: FocusInput): FocusMessage | null {
  const { items, todayMinutes, weekday } = input;
  if (items.length === 0) return null;
  const verdict = goalsVerdict(items);
  if (weekday === 0) {
    return {
      title: "Bilan de la semaine",
      body: `${verdict.done} objectif${verdict.done > 1 ? "s" : ""} atteint${verdict.done > 1 ? "s" : ""} sur ${verdict.total}.${
        verdict.focus ? ` Il te manquait ${formatMinutes(verdict.focus.remainingMinutes)} sur « ${verdict.focus.name} ».` : ""
      }`,
    };
  }
  const today = todayMinutes > 0 ? `Aujourd'hui : ${formatMinutes(todayMinutes)}.` : "Rien d'enregistré aujourd'hui.";
  const rest = verdict.focus
    ? ` Il te reste ${formatMinutes(verdict.focus.remainingMinutes)} sur « ${verdict.focus.name} » cette semaine.`
    : verdict.done === verdict.total
      ? " Objectifs de la semaine atteints."
      : "";
  return { title: "Bilan du soir", body: today + rest };
}
