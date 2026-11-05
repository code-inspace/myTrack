"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Timer, AlertTriangle, Target } from "lucide-react";
import { formatMinutes } from "@/features/session/plan";
import type { GoalsVerdict } from "../insights";

/** The answer to "am I on track?" with the one action that helps most. */
export const GoalsVerdictCard: React.FC<{ verdict: GoalsVerdict }> = ({ verdict }) => {
  if (verdict.total === 0) return null;
  const allDone = verdict.done === verdict.total;
  const headline = allDone
    ? "Tous tes objectifs sont atteints 🎉"
    : `${verdict.onTrack} objectif${verdict.onTrack > 1 ? "s" : ""} sur ${verdict.total} en bonne voie`;
  const Icon = allDone ? CheckCircle2 : verdict.behind > 0 ? AlertTriangle : Target;

  return (
    <section
      aria-labelledby="goals-verdict"
      className="space-y-3 rounded-3xl border border-[#2A2D36] bg-gradient-to-br from-[#1C1D22] to-[#17181D] p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
            verdict.behind > 0 ? "bg-amber-400/15 text-amber-300" : "bg-[#D4F63D]/15 text-[#D4F63D]"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="goals-verdict" className="text-base font-extrabold text-white">
            {headline}
          </h2>
          {verdict.behind > 0 && (
            <p className="text-xs text-[#8E929E]">
              {verdict.behind} en retard ou manqué{verdict.behind > 1 ? "s" : ""}
            </p>
          )}
          {verdict.focus && (
            <p className="mt-1 text-sm text-[#D1D5DB]">
              Il te manque <strong className="text-white">{formatMinutes(verdict.focus.remainingMinutes)}</strong> sur «&nbsp;{verdict.focus.name}&nbsp;».
            </p>
          )}
        </div>
      </div>

      {verdict.focus && (
        <Link
          href={`/session?goal=${encodeURIComponent(verdict.focus.goalId)}&minutes=${verdict.focus.suggestedMinutes}`}
          data-testid="goals-plan-session"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#D4F63D] text-sm font-extrabold text-black hover:bg-[#c5e636]"
        >
          <Timer className="h-4 w-4" aria-hidden="true" />
          Planifier une session de {formatMinutes(verdict.focus.suggestedMinutes)}
        </Link>
      )}
    </section>
  );
};
