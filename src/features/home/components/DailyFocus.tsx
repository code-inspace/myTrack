"use client";

import React from "react";
import { Flame, Settings2 } from "lucide-react";
import { formatMinutes } from "@/features/session/plan";
import { daysUntil, type DailyStreak, type FocusSettings } from "../dailyTarget";

const RADIUS = 38;
const CIRC = 2 * Math.PI * RADIUS;

/** The stake in one line, then today's ring and the streak. Nothing is shown until it is set up. */
export const DailyFocus: React.FC<{
  settings: FocusSettings;
  todayMinutes: number;
  streak: DailyStreak;
  onEdit: () => void;
}> = ({ settings, todayMinutes, streak, onEdit }) => {
  const target = settings.dailyTargetMinutes;
  const pct = target > 0 ? Math.min(100, Math.round((todayMinutes / target) * 100)) : 0;
  const days = daysUntil(settings.stakeDate, new Date());
  const hasStake = settings.stakeText.length > 0;

  if (!hasStake && target <= 0) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#343740] text-sm font-semibold text-[#A1A5B3] hover:border-[#4A4E5C] hover:text-white"
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" /> Fixer mon enjeu et ma cible du jour
      </button>
    );
  }

  const remaining = Math.max(0, target - todayMinutes);

  return (
    <section aria-label="Mon cap" className="space-y-3 rounded-3xl border border-[#23252E] bg-[#141519] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-extrabold text-white">
          {hasStake ? settings.stakeText : "Ma cible du jour"}
          {days !== null && days >= 0 && (
            <span className="ml-2 text-xs font-bold text-[#D4F63D]">J-{days}</span>
          )}
        </p>
        <button type="button" onClick={onEdit} aria-label="Modifier mon cap" className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#8E929E] hover:bg-[#252830] hover:text-white">
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {target > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Aujourd'hui : ${formatMinutes(todayMinutes)} sur ${formatMinutes(target)}, ${pct}%`}>
              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#252830" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="#D4F63D"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - pct / 100)}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white" aria-hidden="true">
              {pct}%
            </span>
          </div>
          <div className="min-w-0 space-y-1 text-sm">
            <p className="text-[#D1D5DB]">
              <strong className="text-white">{formatMinutes(todayMinutes)}</strong> sur {formatMinutes(target)} aujourd&apos;hui
            </p>
            <p className="text-xs text-[#8E929E]">
              {streak.hitToday
                ? "Cible du jour atteinte. Tu peux t'arrêter."
                : streak.restDay
                  ? "Jour de repos : rien d'obligatoire."
                  : `Encore ${formatMinutes(remaining)} pour la cible.`}
            </p>
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#F97316]">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {streak.streak > 0 ? `${streak.streak} jour${streak.streak > 1 ? "s" : ""} d'affilée` : "Pas encore de série"}
              {settings.jokersPerWeek > 0 && (
                <span className="font-semibold text-[#8E929E]">
                  · {streak.jokersLeft} joker{streak.jokersLeft > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
