"use client";

import React from "react";
import { Target, CheckCircle2, Clock, Zap, TrendingUp } from "lucide-react";
import { formatMinutesToHours } from "../types";
import { Period } from "@/features/dashboard/types";

interface GoalSummaryHeaderProps {
  totalTargetMinutes: number;
  totalActualMinutes: number;
  totalTargetCount?: number;
  totalActualCount?: number;
  completedGoalsCount: number;
  totalGoalsCount: number;
  averagePercentage?: number;
  hasCountGoals?: boolean;
  hasDurationGoals?: boolean;
  period: Period;
}

export const GoalSummaryHeader: React.FC<GoalSummaryHeaderProps> = ({
  totalTargetMinutes,
  totalActualMinutes,
  totalTargetCount = 0,
  totalActualCount = 0,
  completedGoalsCount,
  totalGoalsCount,
  averagePercentage,
  hasCountGoals = false,
  hasDurationGoals = true,
  period,
}) => {
  const globalPercentage =
    averagePercentage !== undefined
      ? averagePercentage
      : totalTargetMinutes > 0
      ? Math.round((totalActualMinutes / totalTargetMinutes) * 100)
      : totalTargetCount > 0
      ? Math.round((totalActualCount / totalTargetCount) * 100)
      : 0;

  const fillPercentage = Math.min(100, globalPercentage);
  const periodLabel =
    period === "day"
      ? "aujourd'hui"
      : period === "week"
      ? "cette semaine"
      : period === "month"
      ? "ce mois-ci"
      : "au global";

  return (
    <div className="bg-[#141519] border border-[#23252E] rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute -left-20 -top-20 w-64 h-64 bg-[#D4F63D]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#818CF8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-5">
        {/* Top title and completion badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#D4F63D]/10 border border-[#D4F63D]/25 text-[#D4F63D] flex items-center justify-center shrink-0 shadow-sm">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Vue d'ensemble des Objectifs
              </h2>
              <p className="text-xs text-[#8E929E] mt-0.5 flex items-center gap-1.5">
                <span>Progression cumulée {periodLabel}</span>
                <span>•</span>
                <span className="text-[#D4F63D] font-bold">
                  {completedGoalsCount}/{totalGoalsCount} complété{completedGoalsCount > 1 ? "s" : ""}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-[#1A1C24] border border-[#2B2E3C] px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shadow-inner">
              <Zap className="w-4 h-4 text-[#D4F63D]" />
              <span className="text-xs font-semibold text-[#8E929E]">Taux global :</span>
              <span className="text-sm font-black text-white">{globalPercentage}%</span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#8E929E] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#D4F63D]" />
              <span>
                {hasDurationGoals ? (
                  <>
                    <strong className="text-white">{formatMinutesToHours(totalActualMinutes)}</strong>{" "}
                    réalisé sur{" "}
                    <strong className="text-white">{formatMinutesToHours(totalTargetMinutes)}</strong> visés
                    {hasCountGoals && totalTargetCount > 0 ? ` • ${totalActualCount}/${totalTargetCount} séances` : ""}
                  </>
                ) : (
                  <>
                    <strong className="text-white">{totalActualCount}</strong>{" "}
                    séance{totalActualCount > 1 ? "s" : ""} réalisée{totalActualCount > 1 ? "s" : ""} sur{" "}
                    <strong className="text-white">{totalTargetCount}</strong> visée{totalTargetCount > 1 ? "s" : ""}
                  </>
                )}
              </span>
            </span>
            <span className="text-[#D4F63D] font-bold">{globalPercentage}%</span>
          </div>

          {/* Goal semi-transparent bar with opaque fill */}
          <div className="relative w-full h-4 rounded-full overflow-hidden bg-[#D4F63D]/15 border border-[#D4F63D]/30">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out bg-[#D4F63D] relative"
              style={{
                width: `${fillPercentage}%`,
                boxShadow: globalPercentage > 0 ? "0 0 16px rgba(212, 246, 61, 0.6)" : "none",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/20 rounded-full" />
            </div>
          </div>
        </div>

        {/* 3 mini stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-[#181A22] border border-[#252834] rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#D4F63D]/10 text-[#D4F63D] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#717684]">
                {hasDurationGoals ? "Temps réalisé" : "Séances réalisées"}
              </p>
              <p className="text-sm font-black text-white">
                {hasDurationGoals
                  ? formatMinutesToHours(totalActualMinutes)
                  : `${totalActualCount} séance${totalActualCount > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="bg-[#181A22] border border-[#252834] rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#818CF8]/10 text-[#818CF8] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#717684]">
                {hasDurationGoals ? "Temps visé" : "Séances visées"}
              </p>
              <p className="text-sm font-black text-white">
                {hasDurationGoals
                  ? formatMinutesToHours(totalTargetMinutes)
                  : `${totalTargetCount} séance${totalTargetCount > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="bg-[#181A22] border border-[#252834] rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#717684]">Objectifs validés</p>
              <p className="text-sm font-black text-white">
                {completedGoalsCount} / {totalGoalsCount}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
