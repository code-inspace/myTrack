"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { formatMinutes } from "@/features/session/plan";
import { clampMinutes } from "../quickTimer";

const PRESETS = [15, 30, 45, 60, 90, 120];

/** Bottom sheet asking for a duration: "+ time afterwards" or "how long did you really work". */
export const MinutesSheet: React.FC<{
  title: string;
  description?: string;
  initialMinutes: number;
  confirmLabel: string;
  onConfirm: (minutes: number) => void;
  onClose: () => void;
}> = ({ title, description, initialMinutes, confirmLabel, onConfirm, onClose }) => {
  const [minutes, setMinutes] = useState(clampMinutes(initialMinutes) || 30);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 md:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-3xl border border-[#282A30] bg-[#17181D] p-5 pb-[max(env(safe-area-inset-bottom),20px)] md:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-white">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-[#8E929E]">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#8E929E] hover:bg-[#252830] hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Durées proposées">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minutes === m}
              onClick={() => setMinutes(m)}
              className={`min-h-[44px] cursor-pointer rounded-xl border px-3.5 text-sm font-bold ${
                minutes === m ? "border-[#D4F63D] bg-[#D4F63D] text-black" : "border-[#343740] text-[#D1D5DB] hover:border-[#4A4E5C]"
              }`}
            >
              {formatMinutes(m)}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 text-sm text-[#D1D5DB]">
          <span>Autre durée (min)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            value={minutes || ""}
            onChange={(e) => setMinutes(clampMinutes(Number(e.target.value)))}
            className="w-24 rounded-xl border border-[#343740] bg-[#0E0F12] px-3 py-2 text-white"
          />
        </label>

        <button
          type="button"
          disabled={minutes < 1}
          onClick={() => onConfirm(minutes)}
          className="min-h-[48px] w-full cursor-pointer rounded-2xl bg-[#D4F63D] text-sm font-extrabold text-black hover:bg-[#bce028] disabled:opacity-40"
        >
          {confirmLabel} {minutes >= 1 ? `· ${formatMinutes(minutes)}` : ""}
        </button>
      </div>
    </div>
  );
};
