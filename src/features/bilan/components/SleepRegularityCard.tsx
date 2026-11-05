"use client";

import React, { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { fetchSleepHistory } from "@/features/sleep/actions";
import type { DailySleepLog } from "@/features/sleep/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatMinutes } from "@/features/session/plan";
import { sleepRegularity } from "../insights";
import { EmptyInsight, InsightCard } from "./InsightCard";

const VERDICT = {
  very_regular: { label: "Très régulier", tone: "text-[#D4F63D]" },
  regular: { label: "Plutôt régulier", tone: "text-[#D1D5DB]" },
  irregular: { label: "Irrégulier", tone: "text-amber-300" },
} as const;

/** Regularity matters as much as duration: how much bed and wake times drift from night to night. */
export const SleepRegularityCard: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailySleepLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSleepHistory(30, user?.id)
      .then((history) => {
        if (!cancelled) setLogs(history || []);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (logs === null) return null;
  const result = sleepRegularity(logs, new Date());

  return (
    <InsightCard
      id="insight-sleep"
      title="Ton sommeil est-il régulier ?"
      subtitle="Sur les 14 dernières nuits enregistrées"
      icon={<Moon className="h-4 w-4 text-[#38BDF8]" aria-hidden="true" />}
    >
      {!result ? (
        <EmptyInsight>Enregistre au moins 3 nuits (coucher et réveil) pour voir ta régularité.</EmptyInsight>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[#17181D] p-3">
            <div className="text-lg font-black text-white">{formatMinutes(result.avgDurationMinutes)}</div>
            <div className="text-[11px] text-[#8E929E]">par nuit en moyenne</div>
          </div>
          <div className="rounded-2xl bg-[#17181D] p-3">
            <div className={`text-sm font-black ${VERDICT[result.verdict].tone}`}>{VERDICT[result.verdict].label}</div>
            <div className="text-[11px] text-[#8E929E]">{result.nights} nuits mesurées</div>
          </div>
          <div className="rounded-2xl bg-[#17181D] p-3">
            <div className="text-sm font-black text-white">
              ±{result.bedtimeSpreadMinutes} / ±{result.wakeSpreadMinutes} min
            </div>
            <div className="text-[11px] text-[#8E929E]">écart coucher / réveil</div>
          </div>
        </div>
      )}
    </InsightCard>
  );
};
