"use client";

import React, { useMemo } from "react";
import { Moon, Sparkles, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getStoredSleepLog, computeSleepDuration, getNightSleepDuration } from "@/features/sleep/actions";
import { Period } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

interface SleepWaveChartProps {
  period: Period;
  referenceDate: Date;
}

export const SleepWaveChart: React.FC<SleepWaveChartProps> = ({
  period,
  referenceDate,
}) => {
  const FRENCH_DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  const sleepData = useMemo(() => {
    const daysCount = period === "week" ? 7 : period === "month" ? 14 : 30;
    const points: Array<{
      dateStr: string;
      label: string;
      hours: number;
      durationText: string;
      bedtime: string;
      wakeTime: string;
    }> = [];

    let totalMinutes = 0;
    let validNights = 0;

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = subDays(referenceDate, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const nightData = getNightSleepDuration(dateStr);

      const dayIndex = d.getDay();
      const label =
        period === "week"
          ? `${FRENCH_DAYS_SHORT[dayIndex]} ${format(d, "d")}`
          : format(d, "d MMM", { locale: fr });

      if (nightData) {
        totalMinutes += nightData.duration.hours * 60 + nightData.duration.minutes;
        validNights++;
        points.push({
          dateStr,
          label,
          hours: nightData.duration.decHours,
          durationText: nightData.duration.text,
          bedtime: nightData.yesterdayBedtime,
          wakeTime: nightData.todayWakeTime,
        });
      } else {
        points.push({
          dateStr,
          label,
          hours: 8,
          durationText: "8h 00m (Objectif)",
          bedtime: "23:00",
          wakeTime: "07:00",
        });
      }
    }

    const avgMinutes = validNights > 0 ? Math.round(totalMinutes / validNights) : 8 * 60;
    const avgH = Math.floor(avgMinutes / 60);
    const avgM = avgMinutes % 60;

    return {
      points,
      averageText: `${avgH}h ${String(avgM).padStart(2, "0")}m`,
      averageHours: Math.round((avgMinutes / 60) * 10) / 10,
    };
  }, [period, referenceDate]);

  const maxHours = 12; // Chart scale up to 12h

  return (
    <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
      {/* Header with Average Sleep */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#252830] border border-[#343740] flex items-center justify-center text-[#818CF8] shadow-sm">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Heures de sommeil par nuit</span>
            </h3>
            <p className="text-[11px] text-[#8E929E]">
              Moyenne : <strong className="text-[#D4F63D]">{sleepData.averageText}</strong> / nuit
            </p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#818CF8] text-[11px] font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          <span>Objectif 8h</span>
        </div>
      </div>

      {/* Sleep Bar / Wave Graphic */}
      <div className="pt-2">
        <div className="h-36 flex items-end justify-between gap-1.5 px-1 relative">
          {/* Target 8h guideline */}
          <div
            className="absolute inset-x-0 border-b border-dashed border-[#818CF8]/35 pointer-events-none z-10 flex items-center justify-end pr-1"
            style={{ bottom: `${(8 / maxHours) * 100}%` }}
          >
            <span className="text-[9px] font-mono text-[#818CF8]/80 -mt-3.5">8h</span>
          </div>

          {sleepData.points.map((pt, idx) => {
            const heightPercent = Math.min(100, Math.max(12, (pt.hours / maxHours) * 100));
            const isOptimal = pt.hours >= 7 && pt.hours <= 9;
            const isShort = pt.hours < 6;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip on hover/touch */}
                <div className="absolute -top-8 bg-[#252830] text-white text-[10px] font-mono py-0.5 px-2 rounded-lg border border-[#343740] opacity-0 group-hover:opacity-100 group-hover:-top-9 transition-all pointer-events-none whitespace-nowrap shadow-xl z-30">
                  {pt.durationText} ({pt.bedtime} → {pt.wakeTime})
                </div>

                {/* Animated Pillar Bar */}
                <div
                  className={cn(
                    "w-full rounded-t-xl transition-all duration-300 relative",
                    isOptimal
                      ? "bg-gradient-to-t from-[#818CF8]/40 to-[#818CF8] group-hover:to-[#D4F63D]"
                      : isShort
                      ? "bg-gradient-to-t from-orange-500/40 to-orange-400"
                      : "bg-gradient-to-t from-[#6366F1]/30 to-[#818CF8]/80"
                  )}
                  style={{ height: `${heightPercent}%` }}
                >
                  <div className="absolute -top-4 inset-x-0 text-center text-[10px] font-mono font-bold text-white/80">
                    {pt.hours}h
                  </div>
                </div>

                {/* Label */}
                <span className="text-[10px] font-medium text-[#8E929E] mt-2 truncate max-w-full">
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
