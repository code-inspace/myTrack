"use client";

import React, { useMemo } from "react";
import { Zap } from "lucide-react";
import type { Task, TaskCompletion } from "@/features/tasks/types";
import { focusByHour } from "../insights";
import { EmptyInsight, InsightCard } from "./InsightCard";

const FIRST_HOUR = 5;
const LAST_HOUR = 23;

/** When the work actually gets finished, from the real start/end times of validated tasks. */
export const FocusHoursCard: React.FC<{ tasks: Task[]; completions: TaskCompletion[] }> = ({ tasks, completions }) => {
  const focus = useMemo(() => focusByHour({ tasks, completions }, new Date()), [tasks, completions]);
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const max = Math.max(1, ...hours.map((h) => focus.minutesByHour[h]));

  const summary = focus.best
    ? `Tu termines ${focus.best.sharePercent} % de ton travail entre ${focus.best.startHour}h et ${focus.best.endHour}h.`
    : "";

  return (
    <InsightCard
      id="insight-hours"
      title="Quand travailles-tu le mieux ?"
      subtitle="D'après les horaires réels des 60 derniers jours"
      icon={<Zap className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />}
    >
      {!focus.best ? (
        <EmptyInsight>Il faut quelques tâches validées avec des horaires pour repérer tes meilleures heures.</EmptyInsight>
      ) : (
        <>
          <p className="text-sm text-[#E5E7EB]">
            <strong className="text-white">{summary}</strong> Place ce qui compte le plus dans ce créneau.
          </p>
          <div role="img" aria-label={`Travail par heure de la journée. ${summary}`} className="flex h-24 items-end gap-0.5">
            {hours.map((h) => {
              const inBest = focus.best && h >= focus.best.startHour && h < focus.best.endHour;
              return (
                <div key={h} className="flex flex-1 flex-col items-center gap-1" aria-hidden="true">
                  <div
                    className={inBest ? "w-full rounded-t bg-[#D4F63D]" : "w-full rounded-t bg-[#3A3D4A]"}
                    style={{ height: `${Math.max(2, (focus.minutesByHour[h] / max) * 100)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-[#8E929E]" aria-hidden="true">
            <span>{FIRST_HOUR}h</span>
            <span>12h</span>
            <span>{LAST_HOUR}h</span>
          </div>
        </>
      )}
    </InsightCard>
  );
};
