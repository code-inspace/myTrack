"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { clampMinutes } from "@/features/quicktimer/quickTimer";
import type { FocusSettings } from "../dailyTarget";

/** "Mon cap": the stake shown on the home screen and the daily target with its streak rules. */
export const FocusSettingsSheet: React.FC<{
  initial: FocusSettings;
  onSave: (settings: FocusSettings) => void;
  onClose: () => void;
}> = ({ initial, onSave, onClose }) => {
  const [stakeText, setStakeText] = useState(initial.stakeText);
  const [stakeDate, setStakeDate] = useState(initial.stakeDate);
  const [hours, setHours] = useState(initial.dailyTargetMinutes / 60);
  const [weekdaysOnly, setWeekdaysOnly] = useState(initial.weekdaysOnly);
  const [jokers, setJokers] = useState(initial.jokersPerWeek);

  const field = "w-full rounded-xl border border-[#343740] bg-[#0E0F12] px-3 py-2.5 text-sm text-white";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 md:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mon cap"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl border border-[#282A30] bg-[#17181D] p-5 pb-[max(env(safe-area-inset-bottom),20px)] md:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-extrabold text-white">Mon cap</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[#8E929E] hover:bg-[#252830] hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-white" htmlFor="stake-text">
            Mon enjeu
          </label>
          <input
            id="stake-text"
            type="text"
            maxLength={140}
            value={stakeText}
            onChange={(e) => setStakeText(e.target.value)}
            placeholder="Ex : le studio à Paris, été 2027"
            className={field}
          />
          <label className="block text-xs text-[#8E929E]" htmlFor="stake-date">
            Échéance (optionnel, pour afficher un compte à rebours)
          </label>
          <input id="stake-date" type="date" value={stakeDate} onChange={(e) => setStakeDate(e.target.value)} className={field} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-white" htmlFor="daily-hours">
            Cible par jour (heures, 0 = aucune)
          </label>
          <input
            id="daily-hours"
            type="number"
            inputMode="decimal"
            min={0}
            max={16}
            step={0.5}
            value={hours || ""}
            placeholder="0"
            onChange={(e) => setHours(Number(e.target.value))}
            className={field}
          />
          <p className="text-xs text-[#8E929E]">Compte le temps des projets qui ont un objectif (pas les projets sans cible).</p>
        </div>

        <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm text-[#D1D5DB]">
          <span>Du lundi au vendredi seulement</span>
          <input type="checkbox" checked={weekdaysOnly} onChange={(e) => setWeekdaysOnly(e.target.checked)} className="h-5 w-5 cursor-pointer accent-[#D4F63D]" />
        </label>

        <div className="space-y-1">
          <label className="block text-sm font-bold text-white" htmlFor="jokers">
            Jokers par semaine
          </label>
          <select id="jokers" value={jokers} onChange={(e) => setJokers(Number(e.target.value))} className={field}>
            {[0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Aucun (un jour raté casse la série)" : `${n} jour${n > 1 ? "s" : ""} raté${n > 1 ? "s" : ""} pardonné${n > 1 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() =>
            onSave({
              stakeText: stakeText.trim(),
              stakeDate,
              dailyTargetMinutes: clampMinutes(hours * 60),
              weekdaysOnly,
              jokersPerWeek: jokers,
            })
          }
          className="min-h-[48px] w-full cursor-pointer rounded-2xl bg-[#D4F63D] text-sm font-extrabold text-black hover:bg-[#bce028]"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
};
