"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
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
  computeSleepDuration,
  fetchSleepHistory,
  getStoredSleepLog,
} from "@/features/sleep/actions";
import { DailySleepLog } from "@/features/sleep/types";
import { getTodayDateString } from "@/lib/dates";
import { createClient } from "@/utils/supabase/client";
import { Moon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

import { useTasks } from "@/features/tasks/hooks";
import { isSleepOrNapTitle } from "@/features/sleep/taskSleepSync";

interface SleepWaveChartProps {
  period: Period;
  referenceDate: Date;
}

// 24h window for sleep chart (18:00 on Day 0 to 18:00 on Day 1)
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
  const { tasks: allTasks = [] } = useTasks(todayStr);

  // Fetch real sleep history & listen to realtime updates from iPhone/Widget
  useEffect(() => {
    const loadLogs = () => {
      fetchSleepHistory(180).then((logs) => {
        if (logs && Array.isArray(logs)) {
          setHistoryLogs(logs);
        }
      });
    };

    loadLogs();

    // 1. Listen for local app sleep detection events & storage updates
    const handleAutoSleep = () => {
      loadLogs();
    };
    window.addEventListener("mytrack:sleep-auto-detected", handleAutoSleep);
    window.addEventListener("storage", handleAutoSleep);
    window.addEventListener("focus", loadLogs);

    // 2. Realtime Supabase subscription for cross-device sync (iPhone -> Desktop)
    let channel: any = null;
    try {
      const supabase = createClient();
      const channelName = `sleep_logs_changes_${Math.random().toString(36).slice(2, 7)}`;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sleep_logs" },
          () => {
            loadLogs();
          }
        )
        .subscribe();
    } catch {}

    return () => {
      window.removeEventListener("mytrack:sleep-auto-detected", handleAutoSleep);
      window.removeEventListener("storage", handleAutoSleep);
      window.removeEventListener("focus", loadLogs);
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, []);

  const logsMap = useMemo(() => {
    const map = new Map<string, DailySleepLog>();
    historyLogs.forEach((l) => map.set(l.date, l));
    return map;
  }, [historyLogs]);

  const safeRefDate =
    referenceDate instanceof Date && !isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  // Determine list of days to display based on global page period
  const daysInterval = useMemo(() => {
    try {
      if (period === "day") {
        return [safeRefDate];
      }
      if (period === "month" || period === "all") {
        const start = startOfMonth(safeRefDate);
        const end = endOfMonth(safeRefDate);
        return eachDayOfInterval({ start, end });
      }
      // Default "week": Monday to Sunday
      const start = startOfWeek(safeRefDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    } catch {
      return [safeRefDate];
    }
  }, [period, safeRefDate]);

  // Build data points for each day in interval
  const points = useMemo(() => {
    return daysInterval.map((d, index) => {
      let dateStr = todayStr;
      let prevDateStr = todayStr;
      let fullDateLabel = "Aujourd'hui";
      let dayNum = 1;
      let weekdayInitial = "L";
      let isMonday = false;

      try {
        dateStr = format(d, "yyyy-MM-dd");
        prevDateStr = format(subDays(d, 1), "yyyy-MM-dd");
        fullDateLabel = format(d, "d MMMM yyyy", { locale: fr });
        dayNum = parseInt(format(d, "d"), 10);
        weekdayInitial = format(d, "EEEEE", { locale: fr }).toUpperCase();
        isMonday = d.getDay() === 1;
      } catch {}

      // 1. Strict Future Date Guard: Any day after today cannot have completed sleep
      if (dateStr > todayStr) {
        return {
          date: d,
          dateStr,
          prevDateStr,
          dayNum,
          weekdayInitial,
          fullDateLabel,
          isMonday,
          index,
          isToday: false,
          isFuture: true,
          night: null,
          naps: [],
          hasData: false,
          totalSleepMinutes: 0,
          yesterdayBedtime: null,
          todayWakeTime: null,
          nightDurationText: null,
          napsCount: 0,
          totalNapMinutes: 0,
        };
      }

      const log = logsMap.get(dateStr) || getStoredSleepLog(dateStr);
      const prevLog = logsMap.get(prevDateStr) || getStoredSleepLog(prevDateStr);

      // Find sleep / nap tasks matching this day from the tasks database / agenda
      const daySleepTasks = allTasks.filter((t) => {
        const taskDate = t.createdAt ? t.createdAt.split("T")[0] : null;
        const matchesDate = taskDate === dateStr || (!taskDate && dateStr === todayStr);
        return matchesDate && isSleepOrNapTitle(t.title);
      });

      const eveSleepTasks = allTasks.filter((t) => {
        const taskDate = t.createdAt ? t.createdAt.split("T")[0] : null;
        const matchesDate = taskDate === prevDateStr;
        if (!matchesDate || !isSleepOrNapTitle(t.title)) return false;
        const startHour = t.startTime ? parseInt(t.startTime.split(":")[0], 10) : 0;
        return startHour >= 18;
      });

      // Night sleep: bedtime from eve (D-1) [>= 18h] or early morning of this day (D) [< 12h] + wakeTime from this day (D)
      const prevBedHour = prevLog?.bedtime ? parseInt(prevLog.bedtime.split(":")[0], 10) : null;
      const todayBedHour = log?.bedtime ? parseInt(log.bedtime.split(":")[0], 10) : null;

      const hasPrevBedtimeValidated = Boolean(
        prevLog?.bedtime && prevLog.bedtimeValidated
      );
      const hasPrevEveningBedtime = Boolean(
        prevLog?.bedtime &&
        prevBedHour !== null &&
        prevBedHour >= 18 &&
        (prevLog.bedtimeValidated || prevLog.updatedAt || prevLog.bedtime !== "23:00")
      );

      // 2. Early morning bedtime from today (D): hour < 12
      const hasTodayEarlyBedtimeValidated = Boolean(
        log?.bedtime &&
        todayBedHour !== null &&
        todayBedHour < 12 &&
        log.bedtimeValidated
      );

      // 3. Wake time from today (D)
      const hasTodayWake = Boolean(
        log?.wakeTime && (log.wakeTimeValidated || log.updatedAt || log.wakeTime !== "07:00")
      );

      // 4. Tasks from agenda
      const primaryEveTask = eveSleepTasks[0];
      const primaryEarlyMorningTask = daySleepTasks.find((t) => {
        const h = t.startTime ? parseInt(t.startTime.split(":")[0], 10) : 0;
        return h < 7;
      });

      let bedtime: string | null = null;
      if (hasPrevBedtimeValidated && prevLog?.bedtime) {
        bedtime = prevLog.bedtime;
      } else if (hasTodayEarlyBedtimeValidated && log?.bedtime) {
        bedtime = log.bedtime;
      } else if (primaryEveTask?.startTime) {
        bedtime = primaryEveTask.startTime;
      } else if (primaryEarlyMorningTask?.startTime) {
        bedtime = primaryEarlyMorningTask.startTime;
      } else if (hasPrevEveningBedtime && prevLog?.bedtime) {
        bedtime = prevLog.bedtime;
      } else if (hasTodayWake) {
        if (prevBedHour !== null && prevBedHour >= 18 && prevLog?.bedtime) {
          bedtime = prevLog.bedtime;
        } else if (todayBedHour !== null && todayBedHour < 12 && log?.bedtime) {
          bedtime = log.bedtime;
        } else {
          bedtime = "23:00";
        }
      } else if (hasPrevEveningBedtime || hasTodayEarlyBedtimeValidated) {
        bedtime = prevLog?.bedtime || log?.bedtime || "23:00";
      }

      let wakeTime: string | null = null;
      if (hasTodayWake) {
        wakeTime = log?.wakeTime || "07:00";
      } else if (primaryEarlyMorningTask?.endTime) {
        wakeTime = primaryEarlyMorningTask.endTime;
      } else if (primaryEveTask?.endTime) {
        wakeTime = primaryEveTask.endTime;
      } else if (hasPrevBedtimeValidated || hasPrevEveningBedtime || hasTodayEarlyBedtimeValidated) {
        wakeTime = log?.wakeTime || "07:00";
      }

      let nightBlock: {
        startTime: string;
        endTime: string;
        durationText: string;
        durationMinutes: number;
        topPct: number;
        heightPct: number;
      } | null = null;

      if (bedtime && wakeTime) {
        const dur = computeSleepDuration(bedtime, wakeTime);
        if (dur) {
          const topPct = timeToOffsetPct(bedtime);
          let endPct = timeToOffsetPct(wakeTime);
          if (endPct <= topPct) {
            endPct += 100;
          }
          const maxAvailableHeight = Math.max(0, 100 - topPct);
          const heightPct = Math.min(maxAvailableHeight, Math.max(2, endPct - topPct));

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

      // Combine naps from log and tasks seamlessly
      const combinedNapsMap = new Map<string, { id: string; startTime: string; endTime: string | null }>();
      (log?.naps || []).forEach((n) => {
        if (n.startTime) {
          combinedNapsMap.set(`${n.startTime}-${n.endTime || ""}`, {
            id: n.id,
            startTime: n.startTime,
            endTime: n.endTime,
          });
        }
      });

      daySleepTasks.forEach((t) => {
        const startHour = t.startTime ? parseInt(t.startTime.split(":")[0], 10) : 0;
        const isEarlyMorning = startHour < 7;
        const isPrimaryNight = isEarlyMorning && bedtime === t.startTime;
        if (!isPrimaryNight && t.startTime) {
          const key = `${t.startTime}-${t.endTime || ""}`;
          if (!combinedNapsMap.has(key)) {
            combinedNapsMap.set(key, {
              id: `task-${t.id}`,
              startTime: t.startTime,
              endTime: t.endTime || null,
            });
          }
        }
      });

      // Siestes & phases supplémentaires du jour D
      const naps = Array.from(combinedNapsMap.values()).map((nap) => {
        const topPct = timeToOffsetPct(nap.startTime);
        let endPct = nap.endTime
          ? timeToOffsetPct(nap.endTime)
          : timeToOffsetPct(format(new Date(), "HH:mm"));
        if (endPct <= topPct) {
          endPct += 100;
        }
        const maxAvailableHeight = Math.max(0, 100 - topPct);
        const heightPct = Math.min(maxAvailableHeight, Math.max(1.5, endPct - topPct));

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

      return {
        date: d,
        dateStr,
        prevDateStr,
        dayNum,
        weekdayInitial,
        fullDateLabel,
        isMonday,
        index,
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

  // Real average calculation (including all sleep phases & naps across valid days)
  const { averageText, validNightsCount } = useMemo(() => {
    const daysWithSleep = points.filter((p) => p.totalSleepMinutes > 0);
    if (daysWithSleep.length === 0) {
      return {
        averageText: "—",
        validNightsCount: 0,
      };
    }

    const totalMins = daysWithSleep.reduce(
      (acc, p) => acc + p.totalSleepMinutes,
      0
    );
    const avgMins = Math.round(totalMins / daysWithSleep.length);
    const avgH = Math.floor(avgMins / 60);
    const avgM = avgMins % 60;

    return {
      averageText: `${avgH}h ${String(avgM).padStart(2, "0")}m`,
      validNightsCount: daysWithSleep.length,
    };
  }, [points]);

  // Active Selected Day for the interactive Apple-Health style card/tooltip
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

  // Group month points into weeks for Apple Health month view layout
  const monthWeeks = useMemo(() => {
    if (period !== "month" && period !== "all") return [];
    const weeks: { startDayNum: number; points: typeof points; isCurrentWeek: boolean }[] = [];
    let currentWeek: typeof points = [];

    points.forEach((pt, i) => {
      if (pt.isMonday && currentWeek.length > 0) {
        weeks.push({
          startDayNum: currentWeek[0].dayNum,
          points: currentWeek,
          isCurrentWeek: currentWeek.some((p) => p.dateStr === activeSelectedPoint?.dateStr),
        });
        currentWeek = [];
      }
      currentWeek.push(pt);
      if (i === points.length - 1 && currentWeek.length > 0) {
        weeks.push({
          startDayNum: currentWeek[0].dayNum,
          points: currentWeek,
          isCurrentWeek: currentWeek.some((p) => p.dateStr === activeSelectedPoint?.dateStr),
        });
      }
    });

    return weeks;
  }, [period, points, activeSelectedPoint]);

  // Y-Axis Hour Labels (Matching exact Apple Health scale: 22:00 -> 02:00 -> 06:00 -> 10:00 -> 14:00)
  const axisLabels = [
    { label: "22:00", offsetPct: timeToOffsetPct("22:00") },
    { label: "02:00", offsetPct: timeToOffsetPct("02:00") },
    { label: "06:00", offsetPct: timeToOffsetPct("06:00") },
    { label: "10:00", offsetPct: timeToOffsetPct("10:00") },
    { label: "14:00", offsetPct: timeToOffsetPct("14:00") },
  ];

  const trackHeightPx = 210;
  const isMonthView = period === "month" || period === "all";

  // Selected indicator horizontal coordinate percentage
  const selectedIndex = activeSelectedPoint ? activeSelectedPoint.index : -1;
  const selectedPosPct =
    points.length > 1 && selectedIndex >= 0
      ? ((selectedIndex + 0.5) / points.length) * 100
      : 50;

  return (
    // STRICT CONSTRAINT: Maximum 380px container - Non draggable, pure click selection
    <div
      data-no-swipe="true"
      data-sleep-chart="true"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="w-full max-w-[380px] mx-auto bg-[#000000] border border-[#1C1E26] rounded-3xl p-3 sm:p-4 shadow-2xl select-none overflow-hidden touch-manipulation pointer-events-auto"
    >
      {/* 1. Header with Title and Average */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#181A24] border border-[#2B2E3D] flex items-center justify-center text-[#7B82EE] shadow-sm shrink-0">
            <Moon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>Sommeil</span>
              <span className="text-[10px] font-semibold text-[#8E929E]">
                {period === "day" ? "(Jour)" : period === "week" ? "(Semaine)" : "(Mois)"}
              </span>
            </h3>
            <p className="text-[10px] text-[#8E929E] truncate">
              Moyenne : <strong className="text-[#D4F63D]">{averageText}</strong>
              {validNightsCount > 0 ? ` (${validNightsCount} nuit${validNightsCount > 1 ? "s" : ""})` : ""}
            </p>
          </div>
        </div>

        <div className="px-2 py-0.5 rounded-full bg-[#7B82EE]/15 border border-[#7B82EE]/30 text-[#7B82EE] text-[10px] font-bold flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3" />
          <span>8h visé</span>
        </div>
      </div>

      {/* 2. Apple Health Floating Detail Tooltip Card */}
      <div className="relative w-full flex justify-center pt-1 pb-1">
        <div className="bg-[#14151B] border border-[#232532] shadow-[0_8px_20px_rgba(0,0,0,0.6)] rounded-2xl px-4 py-2 flex flex-col items-center min-w-[160px] max-w-[280px]">
          {/* Tag "AU LIT" with purple bullet */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-[#7B82EE] shadow-[0_0_6px_#7B82EE]" />
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#7B82EE]">
              AU LIT
            </span>
          </div>

          {/* Large Big Duration: Total duration across all sleep phases */}
          <div className="flex items-baseline gap-1 my-0.5">
            {activeSelectedPoint && activeSelectedPoint.totalSleepMinutes > 0 ? (
              <>
                <span className="text-2xl font-black text-white tracking-tight leading-none">
                  {Math.floor(activeSelectedPoint.totalSleepMinutes / 60)}
                </span>
                <span className="text-xs font-semibold text-[#8E929E] mr-0.5">h</span>
                <span className="text-2xl font-black text-white tracking-tight leading-none">
                  {String(activeSelectedPoint.totalSleepMinutes % 60).padStart(2, "0")}
                </span>
                <span className="text-xs font-semibold text-[#8E929E]">min</span>
              </>
            ) : (
              <span className="text-xs font-semibold text-[#8E929E] italic py-0.5">
                Aucune donnée
              </span>
            )}
          </div>

          {/* Date Range: ex: Nuit du 25 au 26 sept. */}
          <span className="text-[10px] font-medium text-[#8E929E] capitalize truncate max-w-full text-center">
            {activeSelectedPoint?.night
              ? `Nuit du ${format(subDays(activeSelectedPoint.date, 1), "d MMM", { locale: fr })} au ${format(activeSelectedPoint.date, "d MMM", { locale: fr })}`
              : activeSelectedPoint?.fullDateLabel || "—"}
          </span>

          {/* All phases breakdown */}
          {activeSelectedPoint && activeSelectedPoint.totalSleepMinutes > 0 && (
            <div className="flex flex-col items-center gap-0.5 mt-1 w-full text-[9px] font-mono">
              {activeSelectedPoint.night && (
                <div className="flex items-center gap-1.5 text-[#7B82EE] font-medium">
                  {activeSelectedPoint.naps.length > 0 && <span className="text-[#8E929E]">Phase 1 :</span>}
                  <span>{activeSelectedPoint.yesterdayBedtime} → {activeSelectedPoint.todayWakeTime}</span>
                  {activeSelectedPoint.naps.length > 0 && (
                    <span className="text-[#8E929E]">({activeSelectedPoint.nightDurationText})</span>
                  )}
                </div>
              )}
              {activeSelectedPoint.naps.map((nap, nIdx) => (
                <div key={nIdx} className="flex items-center gap-1.5 text-[#A78BFA] font-medium">
                  <span className="text-[#8E929E]">
                    Phase {activeSelectedPoint.night ? nIdx + 2 : nIdx + 1} :
                  </span>
                  <span>{nap.startTime} → {nap.endTime || "..."}</span>
                  <span className="text-[#8E929E]">({nap.durationText})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Sleep Timeline Chart Frame */}
      <div className="w-full mt-2 relative">
        <div className="relative w-full rounded-2xl bg-[#000000] overflow-hidden select-none">
          {/* Main Chart Drawing Area */}
          <div className="relative w-full" style={{ height: `${trackHeightPx}px` }}>
            {/* Horizontal hour grid lines (dashed/faint) */}
            {axisLabels.map((axis, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-b border-[#181A24] pointer-events-none z-0"
                style={{ top: `${axis.offsetPct}%` }}
              />
            ))}

            {/* Y-Axis labels placed on the right */}
            {axisLabels.map((axis, i) => (
              <div
                key={i}
                className="absolute right-0 flex items-center -translate-y-1/2 pointer-events-none z-20 pr-1"
                style={{ top: `${axis.offsetPct}%` }}
              >
                <span className="text-[10px] font-mono font-medium text-[#555A6E] bg-[#000000] px-1 py-0.2 rounded">
                  {axis.label}
                </span>
              </div>
            ))}

            {/* Chart Bars Area (bounded on right to leave space for Y labels) */}
            <div className="absolute inset-y-0 left-0 right-[42px] flex items-stretch z-10">
              {/* Selected Day Vertical Indicator Line (from top of chart down to bottom) */}
              {activeSelectedPoint && (
                <div
                  className="absolute inset-y-0 w-px bg-[#545870] pointer-events-none z-20"
                  style={{ left: `${selectedPosPct}%` }}
                />
              )}

              {/* Month View Grouped by Weeks with Dashed Dividers */}
              {isMonthView ? (
                <div className="w-full h-full flex items-stretch">
                  {monthWeeks.map((week, wIdx) => {
                    const isWeekActive = week.isCurrentWeek;

                    return (
                      <div
                        key={wIdx}
                        className={cn(
                          "flex-1 flex items-stretch relative",
                          wIdx > 0 && "border-l border-dashed border-[#232634] pl-[2px]"
                        )}
                      >
                        {/* Days inside this week */}
                        <div className="w-full h-full flex items-stretch gap-[1.5px] px-[1px]">
                          {week.points.map((pt, pIdx) => {
                            const isSelected = activeSelectedPoint?.dateStr === pt.dateStr;

                            return (
                              <div
                                key={pIdx}
                                onClick={() => setSelectedDateStr(pt.dateStr)}
                                className="flex-1 flex flex-col items-center group relative cursor-pointer h-full transition-all"
                              >
                                {/* Bar Track */}
                                <div className="w-full h-full flex items-center justify-center relative z-10">
                                  <div className="relative w-full max-w-[7px] h-full flex justify-center">
                                    {/* Night block */}
                                    {pt.night && (
                                      <div
                                        className={cn(
                                          "absolute inset-x-0 rounded-[2px] transition-all",
                                          isSelected
                                            ? "bg-[#7A85F5] shadow-[0_0_8px_rgba(122,133,245,0.9)] z-20"
                                            : isWeekActive
                                            ? "bg-[#5D6AFF]"
                                            : "bg-[#383C5E] hover:bg-[#4E5482]"
                                        )}
                                        style={{
                                          top: `${pt.night.topPct}%`,
                                          height: `${Math.max(pt.night.heightPct, 3.5)}%`,
                                        }}
                                      />
                                    )}

                                    {/* Nap blocks */}
                                    {pt.naps.map((nap, nIdx) => (
                                      <div
                                        key={nIdx}
                                        className={cn(
                                          "absolute inset-x-0 rounded-[1.5px]",
                                          isSelected
                                            ? "bg-[#9EA8FD]"
                                            : isWeekActive
                                            ? "bg-[#7A85F5]/80"
                                            : "bg-[#383C5E]/70"
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
                    );
                  })}
                </div>
              ) : period === "week" ? (
                /* Week View */
                <div className="w-full h-full flex items-stretch gap-1 px-1">
                  {points.map((pt, idx) => {
                    const isSelected = activeSelectedPoint?.dateStr === pt.dateStr;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDateStr(pt.dateStr)}
                        className="flex-1 flex flex-col items-center group relative cursor-pointer h-full transition-all"
                      >
                        <div className="w-full h-full flex items-center justify-center relative z-10">
                          <div className="relative w-full max-w-[16px] h-full flex justify-center">
                            {/* Night block */}
                            {pt.night && (
                              <div
                                className={cn(
                                  "absolute inset-x-0 rounded-lg transition-all",
                                  isSelected
                                    ? "bg-[#7A85F5] shadow-[0_0_10px_rgba(122,133,245,0.9)]"
                                    : "bg-[#5D6AFF] hover:bg-[#7A85F5]"
                                )}
                                style={{
                                  top: `${pt.night.topPct}%`,
                                  height: `${Math.max(pt.night.heightPct, 3.5)}%`,
                                }}
                              />
                            )}

                            {/* Nap / Multiple Phase blocks */}
                            {pt.naps.map((nap, nIdx) => (
                              <div
                                key={nIdx}
                                className={cn(
                                  "absolute inset-x-0 rounded-lg transition-all",
                                  isSelected
                                    ? "bg-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.9)]"
                                    : "bg-[#8B5CF6]/80 hover:bg-[#A78BFA]"
                                )}
                                style={{
                                  top: `${nap.topPct}%`,
                                  height: `${Math.max(nap.heightPct, 2.5)}%`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Single Day View */
                <div className="w-full h-full flex items-center justify-center">
                  <div className="relative w-14 h-full flex justify-center">
                    {/* Main night block */}
                    {activeSelectedPoint?.night && (
                      <div
                        className="absolute inset-x-0 rounded-xl bg-[#7A85F5] shadow-[0_0_12px_rgba(122,133,245,0.8)]"
                        style={{
                          top: `${activeSelectedPoint.night.topPct}%`,
                          height: `${Math.max(activeSelectedPoint.night.heightPct, 4)}%`,
                        }}
                      />
                    )}

                    {/* All nap / daytime phases blocks */}
                    {activeSelectedPoint?.naps.map((nap, nIdx) => (
                      <div
                        key={nIdx}
                        className="absolute inset-x-0 rounded-xl bg-[#A78BFA] shadow-[0_0_10px_rgba(167,139,250,0.8)]"
                        style={{
                          top: `${nap.topPct}%`,
                          height: `${Math.max(nap.heightPct, 3)}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom X-Axis (Dates / Weekday labels matching the exact image) */}
          <div className="w-full border-t border-[#181A24] pt-2 pb-1 bg-[#000000]">
            <div className="mr-[42px] flex items-center">
              {isMonthView ? (
                monthWeeks.map((week, wIdx) => (
                  <div
                    key={wIdx}
                    className={cn(
                      "flex-1 relative h-4",
                      wIdx > 0 && "border-l border-dashed border-[#232634] pl-1"
                    )}
                  >
                    <span className="text-[11px] font-mono font-bold text-[#555A6E] block">
                      {week.startDayNum}
                    </span>
                  </div>
                ))
              ) : period === "week" ? (
                <div className="w-full flex items-center gap-1 px-1">
                  {points.map((pt, idx) => {
                    const isSelected = activeSelectedPoint?.dateStr === pt.dateStr;
                    return (
                      <div key={idx} className="flex-1 text-center">
                        <span
                          className={cn(
                            "text-[11px] font-mono font-bold transition-colors",
                            isSelected ? "text-[#7B82EE]" : "text-[#555A6E]"
                          )}
                        >
                          {pt.weekdayInitial}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full text-center">
                  <span className="text-xs font-semibold text-[#7B82EE]">
                    {activeSelectedPoint?.fullDateLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
