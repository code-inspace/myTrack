"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Period } from "@/features/dashboard/types";
import {
  format,
  subDays,
  addDays,
  startOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  getNightSleepDuration,
  computeSleepDuration,
  fetchSleepHistory,
  purgeOldSleepLogsExceptYesterday,
} from "@/features/sleep/actions";
import { DailySleepLog } from "@/features/sleep/types";
import { getTodayDateString } from "@/lib/dates";
import { Moon, Sparkles } from "lucide-react";
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

  // Cleanup pre-recorded mock logs and fetch real sleep history
  useEffect(() => {
    purgeOldSleepLogsExceptYesterday().finally(() => {
      fetchSleepHistory(180).then((logs) => {
        if (logs) {
          setHistoryLogs(logs);
        }
      });
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

  // Build data points for each day in interval - ONLY from real verified sleep logs
  const points = useMemo(() => {
    return daysInterval.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const log = logsMap.get(dateStr);
      const nightData = getNightSleepDuration(dateStr);

      const hasNightData = Boolean(
        nightData && nightData.yesterdayBedtime && nightData.todayWakeTime
      );
      const bedtime = nightData ? nightData.yesterdayBedtime : null;
      const wakeTime = nightData ? nightData.todayWakeTime : null;

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
          const heightPct = Math.max(2.5, endPct - topPct);

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
      const naps = (log?.naps || []).map((nap) => {
        const topPct = timeToOffsetPct(nap.startTime);
        const endPct = nap.endTime
          ? timeToOffsetPct(nap.endTime)
          : Math.min(100, topPct + 3);
        const heightPct = Math.max(2, endPct - topPct);

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

      const fullDateLabel = format(d, "d MMMM yyyy", { locale: fr });
      const dayNum = parseInt(format(d, "d"), 10);
      const weekdayInitial = format(d, "EEEEE", { locale: fr }).toUpperCase();
      const isWeekDivider = dayNum === 6 || dayNum === 13 || dayNum === 20 || dayNum === 27;

      return {
        dateStr,
        dayNum,
        weekdayInitial,
        fullDateLabel,
        isWeekDivider,
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
      };
    });
  }, [daysInterval, logsMap, todayStr]);

  // Real average calculation based solely on recorded days with real sleep data
  const { averageText, validNightsCount } = useMemo(() => {
    const daysWithNight = points.filter((p) => p.night);
    if (daysWithNight.length === 0) {
      return {
        averageText: "—",
        validNightsCount: 0,
      };
    }

    const totalMins = daysWithNight.reduce(
      (acc, p) => acc + (p.night?.durationMinutes || 0),
      0
    );
    const avgMins = Math.round(totalMins / daysWithNight.length);
    const avgH = Math.floor(avgMins / 60);
    const avgM = avgMins % 60;

    return {
      averageText: `${avgH}h ${String(avgM).padStart(2, "0")}m`,
      validNightsCount: daysWithNight.length,
    };
  }, [points]);

  // Active Selected Day for the interactive Apple-Health style header card
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

  // Y-Axis Hour Labels (Matching exact Apple Health scale: 22:00 -> 02:00 -> 06:00 -> 10:00 -> 14:00)
  const axisLabels = [
    { label: "22:00", offsetPct: timeToOffsetPct("22:00") },
    { label: "02:00", offsetPct: timeToOffsetPct("02:00") },
    { label: "06:00", offsetPct: timeToOffsetPct("06:00") },
    { label: "10:00", offsetPct: timeToOffsetPct("10:00") },
    { label: "14:00", offsetPct: timeToOffsetPct("14:00") },
  ];

  const trackHeightPx = 230;
  const isMonthView = period === "month" || period === "all";

  return (
    <div className="bg-[#141519] border border-[#24262E] rounded-3xl p-4 sm:p-5 shadow-lg select-none w-full max-w-full overflow-hidden">
      {/* 1. Top Card Header */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#1E2028] border border-[#2D303C] flex items-center justify-center text-[#818CF8] shadow-sm shrink-0">
            <Moon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
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
            <p className="text-[11px] text-[#8E929E] truncate">
              Moyenne : <strong className="text-[#D4F63D]">{averageText}</strong>
              {validNightsCount > 0 ? ` (${validNightsCount} nuit${validNightsCount > 1 ? "s" : ""})` : ""}
            </p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#818CF8] text-[11px] font-bold flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3" />
          <span>Objectif 8h</span>
        </div>
      </div>

      {/* 2. Floating Detail Tooltip (Identical to Apple Health Month Sleep View) */}
      <div className="flex flex-col items-center justify-center pt-2 pb-1 relative z-20">
        <div className="bg-[#1B1C22] border border-[#2D303C] rounded-2xl px-6 py-3 shadow-xl flex flex-col items-center text-center transition-all animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-[#818CF8]">
            <div className="w-2 h-2 rounded-full bg-[#818CF8]" />
            <span>AU LIT</span>
          </div>

          <div className="mt-1 flex items-baseline gap-1 text-white">
            {activeSelectedPoint?.night ? (
              <>
                <span className="text-3xl font-black tracking-tight">
                  {Math.floor(activeSelectedPoint.night.durationMinutes / 60)}
                </span>
                <span className="text-sm font-semibold text-[#8E929E]">h</span>
                <span className="text-3xl font-black tracking-tight ml-1.5">
                  {String(activeSelectedPoint.night.durationMinutes % 60).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold text-[#8E929E]">min</span>
              </>
            ) : (
              <span className="text-lg font-bold text-[#8E929E] italic py-0.5">
                Aucune nuit enregistrée
              </span>
            )}
          </div>

          <div className="text-xs font-semibold text-[#8E929E] mt-1 capitalize">
            {activeSelectedPoint?.fullDateLabel || "Sélectionnez un jour"}
          </div>
        </div>
      </div>

      {/* 3. Sleep Timeline Chart Frame with Exact Apple Health 0-Gap Grid & Bars */}
      <div className="pt-2 w-full">
        <div className="relative w-full rounded-2xl bg-[#0B0C0E] border border-[#1E2028] p-3 sm:p-4 overflow-hidden select-none">
          {/* Main Chart Grid: Left area for contiguous bars, right area for Y-axis labels */}
          <div className="flex items-stretch w-full relative z-10">
            {/* Chart Bars Area */}
            <div className="flex-1 relative flex items-stretch" style={{ height: `${trackHeightPx}px` }}>
              {/* Horizontal hour grid lines across the entire chart bars area */}
              {axisLabels.map((axis, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 border-b border-[#1E2028] pointer-events-none z-0"
                  style={{ top: `${axis.offsetPct}%` }}
                />
              ))}

              {/* Day Columns Container (0 gap between days in month view) */}
              <div
                className={cn(
                  "flex items-stretch w-full relative z-10",
                  isMonthView ? "gap-0" : period === "week" ? "gap-2 sm:gap-3" : "justify-center"
                )}
              >
                {points.map((pt, idx) => {
                  const isSelected = activeSelectedPoint?.dateStr === pt.dateStr;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDateStr(pt.dateStr)}
                      className={cn(
                        "flex flex-col items-center group relative cursor-pointer h-full",
                        isMonthView
                          ? "flex-1 min-w-0"
                          : period === "week"
                          ? "flex-1 max-w-[36px]"
                          : "w-[48px]"
                      )}
                    >
                      {/* Vertical dashed divider on week start days in month view */}
                      {isMonthView && pt.isWeekDivider && (
                        <div className="absolute inset-y-0 left-0 border-l border-dashed border-[#242732] pointer-events-none z-0" />
                      )}

                      {/* Selected vertical cursor pointer line */}
                      {isSelected && (
                        <div className="absolute inset-y-0 w-[1.5px] bg-[#818CF8]/60 pointer-events-none z-0" />
                      )}

                      {/* Bar Column Track */}
                      <div className="w-full flex-1 flex items-center justify-center relative z-10">
                        <div
                          className={cn(
                            "relative transition-all overflow-hidden h-full",
                            isMonthView
                              ? "w-full max-w-[8px] px-[0.5px]"
                              : period === "week"
                              ? "w-full max-w-[20px] rounded-md"
                              : "w-full max-w-[36px] rounded-xl",
                            isSelected
                              ? "bg-[#1E202B]"
                              : "bg-transparent group-hover:bg-[#1A1B22]"
                          )}
                        >
                          {/* Main Night sleep block */}
                          {pt.night && (
                            <div
                              className={cn(
                                "absolute inset-x-[0.5px] rounded-sm transition-all",
                                isSelected
                                  ? "bg-gradient-to-b from-[#818CF8] to-[#6366F1] shadow-[0_0_12px_rgba(129,140,248,0.7)]"
                                  : "bg-gradient-to-b from-[#5B63D3] to-[#4338CA] group-hover:from-[#818CF8] group-hover:to-[#6366F1]"
                              )}
                              style={{
                                top: `${pt.night.topPct}%`,
                                height: `${Math.max(pt.night.heightPct, 3)}%`,
                              }}
                            />
                          )}

                          {/* Nap blocks */}
                          {pt.naps.map((nap, nIdx) => (
                            <div
                              key={nIdx}
                              className={cn(
                                "absolute inset-x-[0.5px] rounded-sm bg-[#A5B4FC]/80",
                                nap.isOpen && "animate-pulse"
                              )}
                              style={{
                                top: `${nap.topPct}%`,
                                height: `${Math.max(nap.heightPct, 2)}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Y-Axis Time Labels */}
            <div
              className="w-12 sm:w-14 shrink-0 relative flex flex-col justify-between pl-2 select-none pointer-events-none"
              style={{ height: `${trackHeightPx}px` }}
            >
              {axisLabels.map((axis, i) => (
                <div
                  key={i}
                  className="absolute right-0 flex items-center -translate-y-1/2"
                  style={{ top: `${axis.offsetPct}%` }}
                >
                  <span className="text-[10px] sm:text-[11px] font-mono font-medium text-[#717684]">
                    {axis.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom X-Axis (Week numbers / Day letters) */}
          <div className="flex items-center w-full pt-3 mt-1 border-t border-[#1E2028]">
            {/* Left area matching chart bars */}
            <div
              className={cn(
                "flex-1 flex items-center",
                isMonthView ? "gap-0" : period === "week" ? "gap-2 sm:gap-3" : "justify-center"
              )}
            >
              {isMonthView ? (
                points.map((pt, idx) => (
                  <div key={idx} className="flex-1 min-w-0 text-left relative h-4">
                    {pt.isWeekDivider && (
                      <span className="absolute left-0 text-[11px] font-mono font-semibold text-[#717684]">
                        {pt.dayNum}
                      </span>
                    )}
                  </div>
                ))
              ) : period === "week" ? (
                points.map((pt, idx) => {
                  const isSelected = activeSelectedPoint?.dateStr === pt.dateStr;
                  return (
                    <div key={idx} className="flex-1 text-center">
                      <span
                        className={cn(
                          "text-[10px] font-mono font-semibold transition-colors",
                          isSelected ? "text-[#818CF8] font-bold" : "text-[#717684]"
                        )}
                      >
                        {pt.weekdayInitial}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center">
                  <span className="text-xs font-semibold text-[#818CF8]">
                    {activeSelectedPoint?.fullDateLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Right spacer aligning with Y-axis */}
            <div className="w-12 sm:w-14 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};



