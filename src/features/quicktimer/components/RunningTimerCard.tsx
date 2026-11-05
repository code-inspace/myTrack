"use client";

import React, { useState } from "react";
import { Square } from "lucide-react";
import { useQuickTimer } from "../useQuickTimer";
import { elapsedMinutes, formatElapsed, looksForgotten } from "../quickTimer";
import { MinutesSheet } from "./MinutesSheet";

/**
 * The running timer. Stop records the time at once, except for a timer that has clearly been
 * forgotten: then it asks how long the work really lasted.
 */
export const RunningTimerCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { timer, now, stop, discard } = useQuickTimer();
  const [asking, setAsking] = useState(false);
  if (!timer) return null;

  const elapsedMs = Math.max(0, now - timer.startedAtMs);
  const color = timer.color || "#D4F63D";
  const forgotten = looksForgotten(timer.startedAtMs, now);

  const onStop = () => (forgotten ? setAsking(true) : stop());

  return (
    <>
      <section
        aria-label="Chrono en cours"
        className={`flex items-center gap-3 rounded-3xl border bg-[#17181D] ${compact ? "p-2.5 pl-4 shadow-xl" : "p-4"}`}
        style={{ borderColor: `${color}66` }}
      >
        <span className="h-3 w-3 flex-shrink-0 animate-pulse rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[#A1A5B3]">{timer.label}</p>
          <p className={`font-black tabular-nums text-white ${compact ? "text-lg" : "text-3xl"}`} role="timer" aria-live="off">
            {formatElapsed(elapsedMs)}
          </p>
          {forgotten && !compact && (
            <p className="text-[11px] text-amber-300">
              Ce chrono tourne depuis longtemps.{" "}
              <button type="button" onClick={discard} className="cursor-pointer font-bold underline">
                Abandonner
              </button>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onStop}
          className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-2xl bg-[#D4F63D] px-5 text-sm font-extrabold text-black hover:bg-[#bce028]"
        >
          <Square className="h-4 w-4 fill-current" aria-hidden="true" /> Stop
        </button>
      </section>

      {asking && (
        <MinutesSheet
          title="Combien de temps as-tu vraiment travaillé ?"
          description={`Le chrono affiche ${elapsedMinutes(timer.startedAtMs, now)} min.`}
          initialMinutes={60}
          confirmLabel="Enregistrer"
          onConfirm={(m) => {
            setAsking(false);
            stop(m);
          }}
          onClose={() => setAsking(false)}
        />
      )}
    </>
  );
};
