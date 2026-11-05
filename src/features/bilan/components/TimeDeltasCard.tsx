"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Clock, Minus } from "lucide-react";
import { useProjects } from "@/features/projects/hooks";
import { formatMinutes } from "@/features/session/plan";
import type { Period } from "@/features/dashboard/types";
import type { Task, TaskCompletion } from "@/features/tasks/types";
import type { ExternalCalendarEvent } from "@/features/calendar/types";
import { NO_PROJECT_KEY, timeDeltas } from "../insights";
import { EmptyInsight, InsightCard } from "./InsightCard";

const PREVIOUS_LABEL: Record<Period, string> = {
  day: "hier",
  week: "la semaine dernière",
  month: "le mois dernier",
  all: "",
};

function Delta({ minutes }: { minutes: number | null }) {
  if (minutes === null) return null;
  if (minutes === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#8E929E]">
        <Minus className="h-3 w-3" aria-hidden="true" /> stable
      </span>
    );
  }
  const up = minutes > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? "text-[#D4F63D]" : "text-amber-300"}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {up ? "+" : "−"}
      {formatMinutes(Math.abs(minutes))}
    </span>
  );
};

/** Where the time went, and how it moved compared with the previous period. */
export const TimeDeltasCard: React.FC<{
  tasks: Task[];
  completions: TaskCompletion[];
  externalEvents: ExternalCalendarEvent[];
  period: Period;
  referenceDate: Date;
}> = ({ tasks, completions, externalEvents, period, referenceDate }) => {
  const { projects = [] } = useProjects();
  const result = useMemo(
    () => timeDeltas({ tasks, completions, externalEvents }, period, referenceDate),
    [tasks, completions, externalEvents, period, referenceDate],
  );
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const max = Math.max(1, ...result.rows.map((r) => r.minutes));
  const totalDelta = result.previousTotalMinutes === null ? null : result.totalMinutes - result.previousTotalMinutes;

  return (
    <InsightCard
      id="insight-time"
      title="Où est passé ton temps ?"
      icon={<Clock className="h-4 w-4 text-[#D4F63D]" aria-hidden="true" />}
      subtitle={
        result.rows.length > 0 ? (
          <span className="flex flex-wrap items-center gap-x-2">
            <strong className="text-white">{formatMinutes(result.totalMinutes)}</strong> au total
            {totalDelta !== null && PREVIOUS_LABEL[period] && (
              <>
                <Delta minutes={totalDelta} /> <span>vs {PREVIOUS_LABEL[period]}</span>
              </>
            )}
          </span>
        ) : undefined
      }
    >
      {result.rows.length === 0 ? (
        <EmptyInsight
          action={
            <Link href="/session" className="inline-block text-sm font-bold text-[#D4F63D] hover:underline">
              Lancer une session
            </Link>
          }
        >
          Aucun temps enregistré sur cette période. Valide des tâches ou lance une session pour le voir ici.
        </EmptyInsight>
      ) : (
        <ul className="space-y-2.5">
          {result.rows.slice(0, 6).map((row) => {
            const project = byId.get(row.key);
            const name = row.key === NO_PROJECT_KEY ? "Sans projet" : project?.name || "Projet";
            const color = project?.color || "#6B7280";
            return (
              <li key={row.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-[#E5E7EB]">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="truncate">{name}</span>
                  </span>
                  <span className="flex flex-shrink-0 items-baseline gap-2">
                    <Delta minutes={row.deltaMinutes} />
                    <strong className="text-white">{formatMinutes(row.minutes)}</strong>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#252830]" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${(row.minutes / max) * 100}%`, backgroundColor: color }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </InsightCard>
  );
};
