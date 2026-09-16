"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Period } from "@/features/dashboard/types";
import {
  format,
  subDays,
  addDays,
  parseISO,
  startOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  getNightSleepDuration,
  getStoredSleepLog,
  computeSleepDuration,
  fetchSleepHistory,
} from "@/features/sleep/actions";
import { DailySleepLog } from "@/features/sleep/types";
import { getTodayDateString } from "@/lib/dates";
import { Moon, Sun, Sparkles, Bed, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SleepWaveChartProps {
  period: Period;
  referenceDate: Date;
}

// Fixed 24h window offset for sleep chart (18:00 on Day 0 to 18:00 on Day 1)
const WINDOW_START_HOUR = 18; // 18:00 (6 PM)
const WINDOW_TOTAL_MINUTES = 24 * 60; // 1440 mins

function timeToOffsetPct(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  let totalMin = h * 60 + m;
  if (h < WINDOW_START_HOUR) {
    totalMin += 24 * 60;
  }
  const windowStartMin = WINDOW_START_HOUR * 60;
  const offsetMins = totalMin - windowStartMin;
  return Math.max(0, Math.min(100, (offsetMins / WINDOW_TOTAL_MINUTES) * 100));
}

export const SleepWaveChart: React.FC<SleepWaveChartProps> = ({
  period,
  referenceDate,
}) => {
  const todayStr = getTodayDateString();
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<DailySleepLog[]>([]);

  // Fetch real sleep history
  useEffect(() => {
    fetchSleepHistory(180).then((logs) => {
      if (logs && logs.length > 0) {
        setHistoryLogs(logs);
      }
    });

    const handleAutoSleep = () => {
      fetchSleepHistory(180).then((logs) => {
        if (logs) setHistoryLogs(logs);
      });
    };
    window.addEventListener("mytrack:sleep-auto-detected", handleAutoSleep);
    return () =>
      window.removeEventListener("mytrack:sleep-auto-detected", handleAutoSleep);
  }, []);

  const logsMap = useMemo(() => {
    const map = new Map<string, DailySleepLog>();
    historyLogs.forEach((l) => map.set(l.date, l));
    return map;
  }, [historyLogs]);

  const getLog = (dateStr: string): DailySleepLog => {
    return logsMap.get(dateStr) || getStoredSleepLog(dateStr);
  };

  // Determine list of days to display based on global page period
  const daysInterval = useMemo(() => {
    if (period === "day") {
      return [referenceDate];
    }
    if (period === "month" || period === "all") {
      const start = startOfMonth(referenceDate);
      const end = endOfMonth(referenceDate);
      return eachDayOfInterval({ start, end });
    }
    // Default "week": Monday to Sunday
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [period, referenceDate]);

  // Build data points for each day in interval
  const points = useMemo(() => {
    return daysInterval.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const log = getLog(dateStr);
      const nightData = getNightSleepDuration(dateStr);
      const yesterdayStr = format(subDays(d, 1), "yyyy-MM-dd");
      const yLog = getLog(yesterdayStr);

      const hasNightData = Boolean(
        nightData ||
          (log.wakeTime && yLog.bedtime) ||
          log.wakeTimeValidated ||
          yLog.bedtimeValidated
      );

      const bedtime = nightData?.yesterdayBedtime || yLog.bedtime || null;
      const wakeTime = nightData?.todayWakeTime || log.wakeTime || null;

      let nightBlock: {
        startTime: string;
        endTime: string;
        durationText: string;
        durationMinutes: number;
        topPct: number;
        heightPct: number;
      } | null = null;

      if (hasNightData && bedtime && wakeTime) {
        const dur = computeSleepDuration(bedtime, wakeTime);
        if (dur) {
          const topPct = timeToOffsetPct(bedtime);
          let endPct = timeToOffsetPct(wakeTime);
          if (endPct <= topPct) endPct += 100;
          const heightPct = Math.max(2, endPct - topPct);

          nightBlock = {
            startTime: bedtime,
            endTime: wakeTime,
            durationText: dur.text,
            durationMinutes: dur.hours * 60 + dur.minutes,
            topPct,
            heightPct,
          };
        }
      }

      // Naps
      const naps = (log.naps || []).map((nap) => {
        const topPct = timeToOffsetPct(nap.startTime);
        const endPct = nap.endTime
          ? timeToOffsetPct(nap.endTime)
          : Math.min(100, topPct + 3);
        const heightPct = Math.max(1.5, endPct - topPct);

        let durationText = "En cours";
        let durationMins = 0;
        if (nap.endTime) {
          const dur = computeSleepDuration(nap.startTime, nap.endTime);
          if (dur) {
            durationText = dur.text;
            durationMins = dur.hours * 60 + dur.minutes;
          }
        }

        return {
          id: nap.id,
          startTime: nap.startTime,
          endTime: nap.endTime,
          durationText,
          durationMins,
          topPct,
          heightPct,
          isOpen: !nap.endTime,
        };
      });

      const totalNapMinutes = naps.reduce((acc, n) => acc + n.durationMins, 0);
      const totalSleepMinutes =
        (nightBlock?.durationMinutes || 0) + totalNapMinutes;

      const fullDateLabel = format(d, "EEEE d MMMM yyyy", { locale: fr });
      const dayNum = parseInt(format(d, "d"), 10);
      let dayLabel = format(d, "EEE", { locale: fr });

      if (period === "month" || period === "all") {
        // Only write day number every 5 days: 1, 5, 10, 15, 20, 25, 30...
        if (dayNum === 1 || dayNum % 5 === 0) {
          dayLabel = String(dayNum);
        } else {
          dayLabel = "";
        }
      }

      return {
        dateStr,
        label: dayLabel,
        dayNum,
        fullDateLabel,
        isToday: dateStr === todayStr,
        night: nightBlock,
        naps,
        hasData: Boolean(nightBlock || naps.length > 0),
        totalSleepMinutes,
        yesterdayBedtime: bedtime,
        todayWakeTime: wakeTime,
        nightDurationText: nightBlock?.durationText || null,
        napsCount: naps.length,
        totalNapMinutes,
        totalNapText:
          totalNapMinutes > 0
            ? `${Math.floor(totalNapMinutes / 60)}h ${String(totalNapMinutes % 60).padStart(2, "0")}m`
            : "0 min",
      };
    });
  }, [daysInterval, logsMap, period, todayStr]);

  // Real average calculation based solely on recorded days
  const { averageText, validNightsCount, totalPeriodMinutesText } = useMemo(() => {
    const daysWithNight = points.filter((p) => p.night);
    if (daysWithNight.length === 0) {
      return {
        averageText: "—",
        validNightsCount: 0,
        totalPeriodMinutesText: "0h",
      };
    }

    const totalMins = daysWithNight.reduce(
      (acc, p) => acc + (p.night?.durationMinutes || 0),
      0
    );
    const avgMins = Math.round(totalMins / daysWithNight.length);
    const avgH = Math.floor(avgMins / 60);
    const avgM = avgMins % 60;

    const totalPeriodH = Math.floor(totalMins / 60);
    const totalPeriodM = totalMins % 60;

    return {
      averageText: `${avgH}h ${String(avgM).padStart(2, "0")}m`,
      validNightsCount: daysWithNight.length,
      totalPeriodMinutesText: `${totalPeriodH}h ${String(totalPeriodM).padStart(2, "0")}m`,
    };
  }, [points]);

  // Selected Day for interactive detail card
  const activeSelectedPoint = useMemo(() => {
    if (selectedDateStr) {
      const found = points.find((p) => p.dateStr === selectedDateStr);
      if (found) return found;
    }
    // Default to today if in range, otherwise the most recent point with data
    const todayPt = points.find((p) => p.dateStr === todayStr);
    if (todayPt && todayPt.hasData) return todayPt;

    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].hasData) return points[i];
    }
    return points[points.length - 1] || null;
  }, [points, selectedDateStr, todayStr]);

  // Y-Axis Hour Labels (18:00 -> 00:00 -> 06:00 -> 12:00 -> 18:00)
  const axisLabels = [
    { label: "22:00", offsetPct: timeToOffsetPct("22:00") },
    { label: "00:00", offsetPct: timeToOffsetPct("00:00") },
    { label: "04:00", offsetPct: timeToOffsetPct("04:00") },
    { label: "08:00", offsetPct: timeToOffsetPct("08:00") },
    { label: "12:00", offsetPct: timeToOffsetPct("12:00") },
  ];

  const trackHeightPx = period === "day" ? 180 : period === "month" || period === "all" ? 220 : 240;

  return (
    <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 select-none">
      {/* 1. Header with Real Average Sleep & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#252830] border border-[#343740] flex items-center justify-center text-[#818CF8] shadow-sm">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Sommeil</span>
              {period === "day" ? (
                <span className="text-[11px] font-semibold text-[#8E929E]">
                  (Journée)
                </span>
              ) : period === "week" ? (
                <span className="text-[11px] font-semibold text-[#8E929E]">
                  (Semaine)
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-[#8E929E]">
                  (Mois)
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#8E929E]">
              Moyenne : <strong className="text-[#D4F63D]">{averageText}</strong>
              {validNightsCount > 0 ? ` (${validNightsCount} nuit${validNightsCount > 1 ? "s" : ""})` : ""}
            </p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#818CF8] text-[11px] font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          <span>Objectif 8h</span>
        </div>
      </div>

      {/* 2. Interactive Day Detail Card */}
      {activeSelectedPoint && (
        <div className="bg-[#17181D] border border-[#2A2D37] rounded-2xl p-3.5 space-y-2.5 transition-all animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#818CF8]" />
              <span className="text-xs font-bold text-white capitalize">
                {activeSelectedPoint.fullDateLabel}
              </span>
            </div>
            {activeSelectedPoint.nightDurationText ? (
              <span className="text-xs font-bold text-[#D4F63D] bg-[#D4F63D]/10 px-2.5 py-0.5 rounded-full border border-[#D4F63D]/25">
                Nuit : {activeSelectedPoint.nightDurationText}
              </span>
            ) : (
              <span className="text-[11px] text-[#8E929E] italic">
                Aucune nuit enregistrée
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Coucher */}
            <div className="bg-[#202229] border border-[#2D303C] rounded-xl p-2 flex flex-col">
              <span className="text-[10px] font-medium text-[#8E929E] flex items-center gap-1">
                <Moon className="w-3 h-3 text-[#818CF8]" /> Coucher
              </span>
              <span className="text-xs font-mono font-bold text-white mt-0.5">
                {activeSelectedPoint.yesterdayBedtime || "—"}
              </span>
            </div>

            {/* Réveil */}
            <div className="bg-[#202229] border border-[#2D303C] rounded-xl p-2 flex flex-col">
              <span className="text-[10px] font-medium text-[#8E929E] flex items-center gap-1">
                <Sun className="w-3 h-3 text-[#FBBF24]" /> Réveil
              </span>
              <span className="text-xs font-mono font-bold text-white mt-0.5">
                {activeSelectedPoint.todayWakeTime || "—"}
              </span>
            </div>

            {/* Siestes */}
            <div className="bg-[#202229] border border-[#2D303C] rounded-xl p-2 flex flex-col">
              <span className="text-[10px] font-medium text-[#8E929E] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#A5B4FC]" /> Sieste
                {activeSelectedPoint.napsCount > 1 ? "s" : ""}
              </span>
              <span className="text-xs font-mono font-bold text-white mt-0.5">
                {activeSelectedPoint.totalNapMinutes > 0
                  ? activeSelectedPoint.totalNapText
                  : "0 min"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sleep Timeline Chart Frame */}
      <div className="pt-1">
        <div className="relative w-full rounded-2xl bg-[#141519] border border-[#282A30] p-2.5 sm:p-3 overflow-hidden select-none">
          {/* Day columns */}
          <div
            className={cn(
              "flex items-stretch w-full relative z-10",
              period === "month" || period === "all" ? "gap-[1px] sm:gap-1" : "gap-1.5 sm:gap-2"
            )}
          >
            {points.map((pt, idx) => {
              const isSelected = activeSelectedPoint?.dateStr === pt.dateStr;
              const isMonthView = period === "month" || period === "all";

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDateStr(pt.dateStr)}
                  className="flex-1 flex flex-col items-center min-w-0 group relative cursor-pointer"
                >
                  {/* Track Bar area */}
                  <div
                    className={cn(
                      "relative transition-all overflow-hidden",
                      isMonthView
                        ? "w-[3px] sm:w-[3.5px] rounded-full"
                        : "w-full rounded-xl",
                      isSelected
                        ? "bg-[#1C1D24] ring-2 ring-[#818CF8] z-20 shadow-lg"
                        : "bg-[#1B1D24] hover:bg-[#2A2D3A]"
                    )}
                    style={{ height: `${trackHeightPx}px` }}
                  >
                    {/* Main Night sleep block */}
                    {pt.night && (
                      <div
                        className={cn(
                          "absolute transition-all",
                          isMonthView
                            ? "inset-x-0 rounded-full"
                            : "inset-x-[15%] rounded-md",
                          isSelected
                            ? "bg-gradient-to-b from-[#818CF8] to-[#6366F1] ring-1 ring-white/30"
                            : "bg-gradient-to-b from-[#818CF8] to-[#6366F1] group-hover:from-[#D4F63D] group-hover:to-[#a9d61f]"
                        )}
                        style={{
                          top: `${pt.night.topPct}%`,
                          height: `${Math.max(pt.night.heightPct, 2)}%`,
                        }}
                      />
                    )}

                    {/* Nap blocks */}
                    {pt.naps.map((nap, nIdx) => (
                      <div
                        key={nIdx}
                        className={cn(
                          "absolute bg-[#A5B4FC]/90",
                          isMonthView
                            ? "inset-x-0 rounded-full"
                            : "inset-x-[25%] rounded-md",
                          nap.isOpen && "animate-pulse"
                        )}
                        style={{
                          top: `${nap.topPct}%`,
                          height: `${Math.max(nap.heightPct, 2)}%`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Date label under column */}
                  <span
                    className={cn(
                      "text-[10px] mt-1.5 truncate max-w-full transition-colors h-3 flex items-center justify-center select-none",
                      isSelected
                        ? "font-bold text-[#818CF8]"
                        : "font-medium text-[#8E929E] group-hover:text-white"
                    )}
                  >
                    {pt.label || "\u00A0"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Horizontal time-of-day gridlines with labels inside chart frame */}
          <div
            className="absolute inset-x-2.5 sm:inset-x-3 top-2.5 sm:top-3 pointer-events-none z-0"
            style={{ height: `${trackHeightPx}px` }}
          >
            {axisLabels.map((axis, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-b border-dashed border-[#242732] flex items-center justify-end"
                style={{ top: `${axis.offsetPct}%` }}
              >
                <span className="text-[9px] font-mono font-semibold text-[#8E929E] bg-[#141519]/90 px-1 py-0.5 rounded border border-[#282A30] shadow-sm -mr-0.5">
                  {axis.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
