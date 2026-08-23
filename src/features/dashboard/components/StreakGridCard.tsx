"use client";

import React from "react";
import { DayStatus } from "../types";
import { Check, X, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakGridCardProps {
  currentStreak: number;
  days: DayStatus[];
}

export const StreakGridCard: React.FC<StreakGridCardProps> = ({
  currentStreak = 4,
  days = [],
}) => {
  // If days empty, provide default representation
  const displayDays =
    days.length === 7
      ? days
      : [
          { date: "1", dayName: "Thu", status: "completed" },
          { date: "2", dayName: "Fri", status: "missed" },
          { date: "3", dayName: "Sat", status: "missed" },
          { date: "4", dayName: "Sun", status: "completed" },
          { date: "5", dayName: "Mon", status: "completed" },
          { date: "6", dayName: "Tue", status: "completed" },
          { date: "7", dayName: "Wed", status: "completed" },
        ];

  return (
    <div className="w-full bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm">
      {/* Header: Title and Flame streak counter */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white tracking-tight">
          Current streak
        </h3>

        <div className="flex items-center gap-1.5 text-base font-bold text-[#F97316]">
          <Flame className="w-5 h-5 fill-[#F97316] text-[#F97316] animate-pulse" />
          <span>{currentStreak} {currentStreak === 1 ? "day" : "days"}</span>
        </div>
      </div>

      {/* 7 Days Row */}
      <div className="flex items-center justify-between gap-1 pt-1">
        {displayDays.map((d, i) => {
          const isDone = d.status === "completed";
          return (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                  isDone
                    ? "bg-[#D4F63D] text-black shadow-sm"
                    : "bg-[#282A30] text-[#6B7280]"
                )}
              >
                {isDone ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
              </div>

              <span className="text-[11px] font-semibold text-[#8E929E]">
                {d.dayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
