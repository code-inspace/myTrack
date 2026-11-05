"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { Period } from "@/features/dashboard/types";
import type { Task, TaskCompletion } from "@/features/tasks/types";
import { plannedVsDone } from "../insights";
import { EmptyInsight, InsightCard } from "./InsightCard";

/** How much of what was planned actually got done — and what keeps slipping to the next day. */
export const PlannedVsDoneCard: React.FC<{
  tasks: Task[];
  completions: TaskCompletion[];
  period: Period;
  referenceDate: Date;
}> = ({ tasks, completions, period, referenceDate }) => {
  const result = useMemo(
    () => plannedVsDone({ tasks, completions }, period, referenceDate, new Date()),
    [tasks, completions, period, referenceDate],
  );

  return (
    <InsightCard
      id="insight-plan"
      title="Prévu / fait"
      icon={<ListChecks className="h-4 w-4 text-[#60A5FA]" aria-hidden="true" />}
      subtitle={period === "all" ? "Sur les 30 derniers jours" : undefined}
    >
      {result.planned === 0 ? (
        <EmptyInsight>Rien de planifié sur cette période.</EmptyInsight>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{result.rate}%</span>
            <span className="text-sm text-[#8E929E]">
              {result.done} tâche{result.done > 1 ? "s" : ""} faite{result.done > 1 ? "s" : ""} sur {result.planned} prévue
              {result.planned > 1 ? "s" : ""}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={result.rate ?? 0}
            aria-label="Part des tâches prévues qui ont été faites"
            className="h-2.5 overflow-hidden rounded-full bg-[#252830]"
          >
            <div className="h-full rounded-full bg-[#60A5FA]" style={{ width: `${result.rate ?? 0}%` }} />
          </div>
        </>
      )}
      {result.carriedOver > 0 && (
        <p className="text-sm text-[#D1D5DB]">
          <strong className="text-amber-300">{result.carriedOver}</strong> tâche{result.carriedOver > 1 ? "s" : ""} reportée
          {result.carriedOver > 1 ? "s" : ""} d&apos;un jour à l&apos;autre.{" "}
          <Link href="/tasks" className="font-bold text-[#D4F63D] hover:underline">
            Les traiter
          </Link>
        </p>
      )}
    </InsightCard>
  );
};
