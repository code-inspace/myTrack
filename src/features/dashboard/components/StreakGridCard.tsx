"use client";

import React from "react";
import { HabitStreakStat, DayStatus } from "../types";
import { Check, X, Flame, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakGridCardProps {
  habitStreaks: HabitStreakStat[];
  dailyStatus?: DayStatus[];
}

export const StreakGridCard: React.FC<StreakGridCardProps> = ({
  habitStreaks = [],
  dailyStatus = [],
}) => {
  return (
    <div className="w-full bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-5">
      {/* 1. Card Top Bar: Daily % Performance Summary (sans streak global) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-base font-bold text-white tracking-tight">
            Suivi par habitude
          </h3>
          <span className="text-xs font-semibold text-[#8E929E]">
            {habitStreaks.length} habitude{habitStreaks.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Rolling 7-Day % Progress Row */}
        {dailyStatus.length === 7 && (
          <div className="grid grid-cols-7 gap-1.5 p-2.5 bg-[#141518] rounded-2xl border border-[#252830]">
            {dailyStatus.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-[#8E929E]">
                  {d.dayName}
                </span>
                <div
                  className={cn(
                    "w-full py-1 rounded-lg text-[10px] font-mono font-extrabold text-center transition-all",
                    d.completionPercentage >= 100
                      ? "bg-[#D4F63D] text-black shadow-sm"
                      : d.completionPercentage > 0
                        ? "bg-[#D4F63D]/20 text-[#D4F63D] border border-[#D4F63D]/30"
                        : "bg-[#202228] text-[#6B7280]"
                  )}
                >
                  {d.completionPercentage}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Habit Rows or Empty State */}
      {habitStreaks.length === 0 ? (
        <div className="p-6 text-center bg-[#141518] rounded-2xl border border-[#252830] space-y-2">
          <Sparkles className="w-6 h-6 text-[#D4F63D] mx-auto opacity-80" />
          <p className="text-xs font-semibold text-white">
            Ajouter des tâches récurrentes pour pouvoir les suivre
          </p>
          <p className="text-[11px] text-[#8E929E]">
            Créez une habitude quotidienne ou hebdomadaire pour suivre votre progression ici.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {habitStreaks.map((habit) => (
          <div
            key={habit.taskId}
            className="p-3.5 bg-[#141518]/90 rounded-2xl border border-[#262932] space-y-3 shadow-sm hover:border-[#353945] transition-colors"
          >
            {/* Habit Header: Title + Category + Individual Streak */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <span className="text-xs font-bold text-white truncate">
                  {habit.taskTitle}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#252830] text-[#8E929E] font-semibold flex-shrink-0">
                  {habit.category}
                </span>
              </div>

              {/* Individual Streak Counter */}
              <div className="flex items-center gap-1 text-xs font-extrabold text-[#F97316] flex-shrink-0 bg-[#F97316]/10 px-2 py-1 rounded-xl border border-[#F97316]/20">
                <Flame className="w-3.5 h-3.5 fill-[#F97316] animate-pulse" />
                <span>
                  {habit.currentStreak} {habit.currentStreak <= 1 ? "jour" : "jours"}
                </span>
              </div>
            </div>

            {/* 7 Days Row for this Habit */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              {habit.rolling7Days.map((d, i) => {
                const isDone = d.isCompleted;
                const isScheduled = d.isScheduled;

                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                        isDone
                          ? "bg-[#D4F63D] text-black shadow-sm scale-105"
                          : isScheduled
                            ? "bg-[#282A30] text-[#6B7280]"
                            : "bg-[#18191E] border border-[#282A30] text-[#4B5563]"
                      )}
                      title={`${d.dayName}: ${isDone ? "Accomplie" : isScheduled ? "Non faite" : "Non planifiée"}`}
                    >
                      {isDone ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : isScheduled ? (
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      ) : (
                        <Minus className="w-3 h-3 opacity-40" />
                      )}
                    </div>

                    <span className="text-[10px] font-semibold text-[#8E929E]">
                      {d.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};
