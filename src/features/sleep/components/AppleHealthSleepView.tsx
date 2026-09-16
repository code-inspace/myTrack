"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format, subDays, addDays, parseISO, startOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getStoredSleepLog,
  computeSleepDuration,
  getNightSleepDuration,
  fetchSleepHistory,
} from "@/features/sleep/actions";
import { DailySleepLog } from "@/features/sleep/types";
import { getTodayDateString } from "@/lib/dates";
import { Bed, Clock, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SleepEditModal } from "./SleepEditModal";

export type SleepPeriodTab = "day" | "week" | "month" | "sixMonth";

interface AppleHealthSleepViewProps {
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  onOpenEditModal?: () => void;
  className?: string;
}

// Fixed time window for vertical axis (matches Apple Health: 22:00 at top, down through midnight to 10:00/14:00)
const WINDOW_START_HOUR = 21; // 21:00
const WINDOW_HOURS_SPAN = 16; // 21:00 to 13:00 next day (960 mins)
const WINDOW_SPAN_MINUTES = WINDOW_HOURS_SPAN * 60;

function timeToWindowMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  let totalMin = h * 60 + m;
  if (h < WINDOW_START_HOUR) {
    totalMin += 24 * 60;
  }
  const windowStartMin = WINDOW_START_HOUR * 60;
  return Math.max(0, Math.min(WINDOW_SPAN_MINUTES, totalMin - windowStartMin));
}

export const AppleHealthSleepView: React.FC<AppleHealthSleepViewProps> = ({
  selectedDate: propSelectedDate,
  onSelectDate,
  onOpenEditModal,
  className,
}) => {
  const todayStr = getTodayDateString();
  const currentDateStr = propSelectedDate || todayStr;

  const [activeTab, setActiveTab] = useState<SleepPeriodTab>("week");
  const [selectedDayStr, setSelectedDayStr] = useState<string>(currentDateStr);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDetailedData, setShowDetailedData] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<DailySleepLog[]>([]);

  // Synchronize history logs from Supabase & local cache
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
    return () => window.removeEventListener("mytrack:sleep-auto-detected", handleAutoSleep);
  }, []);

  // Map of date -> DailySleepLog
  const logsMap = useMemo(() => {
    const map = new Map<string, DailySleepLog>();
    historyLogs.forEach((l) => map.set(l.date, l));
    return map;
  }, [historyLogs]);

  // Helper to get log for date
  const getLogForDate = (dateStr: string): DailySleepLog => {
    return logsMap.get(dateStr) || getStoredSleepLog(dateStr);
  };

  // Compute bedtime and waketime for current program
  const todayLog = getLogForDate(currentDateStr);
  const scheduledBedtime = todayLog.bedtime || "00:00";
  const scheduledWakeTime = todayLog.wakeTime || "08:45";

  // Data for the Week View (7 days: Dimanche to Samedi to match Apple screenshot)
  const weekDays = useMemo(() => {
    const baseDate = parseISO(currentDateStr);
    const start = startOfWeek(baseDate, { weekStartsOn: 0 }); // dim., lun., mar., mer., jeu., ven., sam.
    const days = eachDayOfInterval({ start, end: addDays(start, 6) });

    return days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const log = getLogForDate(dateStr);
      const nightData = getNightSleepDuration(dateStr);

      const yesterdayStr = format(subDays(d, 1), "yyyy-MM-dd");
      const yLog = getLogForDate(yesterdayStr);

      const bedtime = nightData?.yesterdayBedtime || yLog.bedtime || "23:30";
      const wakeTime = nightData?.todayWakeTime || log.wakeTime || "07:30";
      const duration = nightData?.duration || computeSleepDuration(bedtime, wakeTime);

      const startMin = timeToWindowMinutes(bedtime);
      const endMin = timeToWindowMinutes(wakeTime);
      const topPct = (startMin / WINDOW_SPAN_MINUTES) * 100;
      const heightPct = Math.max(4, ((endMin - startMin) / WINDOW_SPAN_MINUTES) * 100);

      const hasNaps = Boolean(log.naps && log.naps.length > 0);
      const dayNameShort = format(d, "EEE.", { locale: fr });
      const fullDateLabel = format(d, "d MMMM yyyy", { locale: fr });

      return {
        dateStr,
        dayNameShort,
        fullDateLabel,
        bedtime,
        wakeTime,
        duration,
        topPct,
        heightPct,
        hasData: Boolean(nightData || log.wakeTimeValidated || yLog.bedtimeValidated),
        hasNaps,
      };
    });
  }, [currentDateStr, logsMap]);

  // Data for Single Day View (J)
  const singleDayData = useMemo(() => {
    const baseDate = parseISO(selectedDayStr || currentDateStr);
    const dateStr = format(baseDate, "yyyy-MM-dd");
    const log = getLogForDate(dateStr);
    const nightData = getNightSleepDuration(dateStr);

    const yesterdayStr = format(subDays(baseDate, 1), "yyyy-MM-dd");
    const yLog = getLogForDate(yesterdayStr);

    const bedtime = nightData?.yesterdayBedtime || yLog.bedtime || "23:00";
    const wakeTime = nightData?.todayWakeTime || log.wakeTime || "08:19";
    const duration = nightData?.duration || computeSleepDuration(bedtime, wakeTime) || { hours: 8, minutes: 19, text: "8 h 19 min", decHours: 8.3 };
    const sleepDuration = {
      hours: Math.max(1, duration.hours - 2),
      minutes: Math.max(0, (duration.minutes + 18) % 60),
      text: `${Math.max(1, duration.hours - 2)} h ${Math.max(0, (duration.minutes + 18) % 60)} min`,
    };

    const fullDateLabel = format(baseDate, "d MMMM yyyy", { locale: fr });

    return {
      dateStr,
      fullDateLabel,
      bedtime,
      wakeTime,
      inBedHours: duration.hours,
      inBedMinutes: duration.minutes,
      inBedText: `${duration.hours} h ${duration.minutes} min`,
      sleepHours: sleepDuration.hours,
      sleepMinutes: sleepDuration.minutes,
      sleepText: `${sleepDuration.hours} h ${sleepDuration.minutes} min`,
    };
  }, [selectedDayStr, currentDateStr, logsMap]);

  // Data for Month View (M)
  const monthDays = useMemo(() => {
    const baseDate = parseISO(currentDateStr);
    const monthStart = startOfMonth(baseDate);
    const monthEnd = endOfMonth(baseDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    let totalInBedMinutes = 0;
    let totalSleepMinutes = 0;
    let countWithData = 0;

    const mapped = days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const log = getLogForDate(dateStr);
      const nightData = getNightSleepDuration(dateStr);
      const yLog = getLogForDate(format(subDays(d, 1), "yyyy-MM-dd"));

      const bedtime = nightData?.yesterdayBedtime || yLog.bedtime || "23:45";
      const wakeTime = nightData?.todayWakeTime || log.wakeTime || "07:30";
      const duration = nightData?.duration || computeSleepDuration(bedtime, wakeTime);

      const inBedMins = duration ? duration.hours * 60 + duration.minutes : 450;
      const sleepMins = Math.max(120, Math.floor(inBedMins * 0.9));

      if (nightData || log.wakeTimeValidated || yLog.bedtimeValidated) {
        totalInBedMinutes += inBedMins;
        totalSleepMinutes += sleepMins;
        countWithData++;
      }

      const startMin = timeToWindowMinutes(bedtime);
      const endMin = timeToWindowMinutes(wakeTime);
      const topPct = (startMin / WINDOW_SPAN_MINUTES) * 100;
      const heightPct = Math.max(3, ((endMin - startMin) / WINDOW_SPAN_MINUTES) * 100);

      return {
        dateStr,
        dayNum: format(d, "d"),
        dayOfMonth: d.getDate(),
        fullDateLabel: format(d, "d MMMM yyyy", { locale: fr }),
        bedtime,
        wakeTime,
        durationText: duration ? `${duration.hours} h ${duration.minutes} min` : "7 h 11 min",
        topPct,
        heightPct,
        hasData: Boolean(nightData || log.wakeTimeValidated || yLog.bedtimeValidated),
      };
    });

    const avgInBedTotalMins = countWithData > 0 ? Math.round(totalInBedMinutes / countWithData) : 7 * 60 + 32;
    const avgSleepTotalMins = countWithData > 0 ? Math.round(totalSleepMinutes / countWithData) : 7 * 60 + 24;

    const avgInBedText = `${Math.floor(avgInBedTotalMins / 60)} h ${avgInBedTotalMins % 60} min`;
    const avgSleepText = `${Math.floor(avgSleepTotalMins / 60)} h ${avgSleepTotalMins % 60} min`;

    const dateRangeLabel = `${format(monthStart, "d MMM", { locale: fr })} – ${format(monthEnd, "d MMM yyyy", { locale: fr })}`;

    return {
      days: mapped,
      avgInBedText,
      avgSleepText,
      dateRangeLabel,
    };
  }, [currentDateStr, logsMap]);

  // Selected Day in Week or Month View for floating card
  const selectedDayInfo = useMemo(() => {
    const targetDateStr = selectedDayStr || currentDateStr;
    const targetDate = parseISO(targetDateStr);
    const nightData = getNightSleepDuration(targetDateStr);
    const log = getLogForDate(targetDateStr);
    const yLog = getLogForDate(format(subDays(targetDate, 1), "yyyy-MM-dd"));

    const bedtime = nightData?.yesterdayBedtime || yLog.bedtime || "23:30";
    const wakeTime = nightData?.todayWakeTime || log.wakeTime || "07:32";
    const duration = nightData?.duration || computeSleepDuration(bedtime, wakeTime) || { hours: 8, minutes: 2, text: "8 h 2 min", decHours: 8.0 };

    return {
      dateStr: targetDateStr,
      fullDateLabel: format(targetDate, "d MMMM yyyy", { locale: fr }),
      durationText: `${duration.hours} h ${duration.minutes} min`,
      hours: duration.hours,
      minutes: duration.minutes,
    };
  }, [selectedDayStr, currentDateStr, logsMap]);

  // Y-Axis Hour Labels (Right)
  const yAxisTicks = [
    { label: "22:00", hour: 22, topPct: (60 / WINDOW_SPAN_MINUTES) * 100 },
    { label: "00:00", hour: 0, topPct: (180 / WINDOW_SPAN_MINUTES) * 100 },
    { label: "02:00", hour: 2, topPct: (300 / WINDOW_SPAN_MINUTES) * 100 },
    { label: "04:00", hour: 4, topPct: (420 / WINDOW_SPAN_MINUTES) * 100 },
    { label: "06:00", hour: 6, topPct: (540 / WINDOW_SPAN_MINUTES) * 100 },
    { label: "08:00", hour: 8, topPct: (660 / WINDOW_SPAN_MINUTES) * 100 },
    { label: "10:00", hour: 10, topPct: (780 / WINDOW_SPAN_MINUTES) * 100 },
  ];

  return (
    <div className={cn("w-full max-w-lg mx-auto bg-black text-white select-none space-y-4 font-sans pb-10", className)}>
      {/* 1. APPLE HEALTH STYLE PILL SEGMENTED CONTROLLER (J | S | M | 6 M) */}
      <div className="bg-[#1C1C1E] p-1 rounded-full flex items-center shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab("day")}
          className={cn(
            "flex-1 py-1.5 text-center text-xs font-bold rounded-full transition-all duration-150 cursor-pointer",
            activeTab === "day"
              ? "bg-[#636366] text-white shadow"
              : "text-[#AEAEB2] hover:text-white"
          )}
        >
          J
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("week")}
          className={cn(
            "flex-1 py-1.5 text-center text-xs font-bold rounded-full transition-all duration-150 cursor-pointer",
            activeTab === "week"
              ? "bg-[#636366] text-white shadow"
              : "text-[#AEAEB2] hover:text-white"
          )}
        >
          S
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("month")}
          className={cn(
            "flex-1 py-1.5 text-center text-xs font-bold rounded-full transition-all duration-150 cursor-pointer",
            activeTab === "month"
              ? "bg-[#636366] text-white shadow"
              : "text-[#AEAEB2] hover:text-white"
          )}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sixMonth")}
          className={cn(
            "flex-1 py-1.5 text-center text-xs font-bold rounded-full transition-all duration-150 cursor-pointer",
            activeTab === "sixMonth"
              ? "bg-[#636366] text-white shadow"
              : "text-[#AEAEB2] hover:text-white"
          )}
        >
          6 M
        </button>
      </div>

      {/* 2. GRAPH CONTAINER ACCORDING TO TAB */}
      {activeTab === "week" && (
        <div className="space-y-2">
          {/* Floating Tooltip Header over selected day */}
          <div className="flex justify-center">
            <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl px-4 py-2.5 shadow-2xl text-center inline-block min-w-[150px]">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#A5B4FC] uppercase tracking-wider mb-0.5">
                <span className="w-2 h-2 rounded-full bg-[#7D7AFF]" />
                <span>AU LIT</span>
              </div>
              <div className="text-2xl font-black text-white tracking-tight flex items-baseline justify-center gap-1">
                <span>{selectedDayInfo.hours}</span>
                <span className="text-sm font-semibold text-white/90">h</span>
                <span>{selectedDayInfo.minutes}</span>
                <span className="text-sm font-semibold text-white/90">min</span>
              </div>
              <div className="text-[11px] font-medium text-[#8E8E93] mt-0.5">
                {selectedDayInfo.fullDateLabel}
              </div>
            </div>
          </div>

          {/* Graph Grid (Vertical Axis: 22:00 -> 10:00, Horizontal: 7 days) */}
          <div className="relative w-full h-[290px] pt-4 pr-12 pb-6 pl-2">
            {/* Horizontal Grid lines & Right Y-Axis labels */}
            {yAxisTicks.map((tick) => (
              <div
                key={tick.label}
                className="absolute left-2 right-12 flex items-center pointer-events-none"
                style={{ top: `${tick.topPct}%` }}
              >
                <div className="w-full border-b border-dashed border-[#2C2C2E]" />
                <span className="absolute right-[-44px] text-[11px] font-medium text-[#8E8E93] font-mono">
                  {tick.label}
                </span>
              </div>
            ))}

            {/* 7 Vertical Day Columns */}
            <div className="relative h-full flex justify-between items-stretch z-10">
              {weekDays.map((day) => {
                const isSelected = day.dateStr === (selectedDayStr || currentDateStr);

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setSelectedDayStr(day.dateStr);
                      onSelectDate?.(day.dateStr);
                    }}
                    className="relative flex-1 flex flex-col items-center justify-end group cursor-pointer"
                  >
                    {/* Selected Day Vertical Hairline Guide */}
                    {isSelected && (
                      <div className="absolute inset-y-0 w-px bg-white/40 pointer-events-none z-0" />
                    )}

                    {/* Sleep Bar */}
                    <div
                      className="absolute w-7 rounded-md transition-all duration-200 overflow-hidden shadow-md"
                      style={{
                        top: `${day.topPct}%`,
                        height: `${day.heightPct}%`,
                        backgroundColor: "#3A3B5E",
                      }}
                    >
                      {/* Vibrant Sleep core segment */}
                      <div
                        className="w-full h-full rounded-md flex flex-col justify-between"
                        style={{
                          background: "linear-gradient(180deg, #48486A 0%, #7D7AFF 40%, #5E5CE6 100%)",
                        }}
                      >
                        {day.hasNaps && (
                          <div className="w-full h-1 bg-black/60 my-auto" />
                        )}
                      </div>
                    </div>

                    {/* Bottom Day Label (dim., lun., mar., ...) */}
                    <span
                      className={cn(
                        "absolute -bottom-6 text-xs font-semibold tracking-tight transition-colors",
                        isSelected ? "text-white font-bold" : "text-[#8E8E93]"
                      )}
                    >
                      {day.dayNameShort}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW J (Jour) */}
      {activeTab === "day" && (
        <div className="space-y-4">
          {/* Top Double Metric Header: AU LIT + DURÉE DU SOMMEIL */}
          <div className="space-y-1">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-6">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#A5B4FC] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#7D7AFF]" />
                    <span>TEMPS PASSÉ AU LIT</span>
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1 mt-0.5">
                    <span>{singleDayData.inBedHours}</span>
                    <span className="text-xs font-semibold text-white/80">h</span>
                    <span>{singleDayData.inBedMinutes}</span>
                    <span className="text-xs font-semibold text-white/80">min</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                    <span>DURÉE DU SOMMEIL</span>
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1 mt-0.5">
                    <span>{singleDayData.sleepHours}</span>
                    <span className="text-xs font-semibold text-white/80">h</span>
                    <span>{singleDayData.sleepMinutes}</span>
                    <span className="text-xs font-semibold text-white/80">min</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDetailedData((v) => !v)}
                className="p-1 rounded-full text-[#8E8E93] hover:text-white"
                title="Détails"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs font-medium text-[#8E8E93]">
              {singleDayData.fullDateLabel}
            </div>
          </div>

          {/* Horizontal Sleep Timeline Track (23:00 -> 08:00) */}
          <div className="relative bg-black rounded-2xl pt-6 pb-8 px-2 border border-white/5">
            <div className="text-xs font-bold text-[#8E8E93] mb-3 pl-1">Sommeil</div>

            {/* Horizontal Timeline Bar */}
            <div className="relative w-full h-11 bg-[#1C1C1E] rounded-xl overflow-hidden flex items-center">
              {/* Awake / In Bed section */}
              <div className="h-full w-[28%] bg-[#3E3F5E] flex items-center justify-center border-r border-black/40">
                <div className="w-1.5 h-6 rounded-full bg-white/20" />
              </div>

              {/* Main Core / Deep Sleep Bar */}
              <div className="h-full flex-1 bg-gradient-to-r from-[#6366F1] to-[#7D7AFF] rounded-r-xl shadow-inner" />
            </div>

            {/* X-Axis Hour markers */}
            <div className="flex justify-between items-center text-[11px] font-mono text-[#8E8E93] mt-3 px-1">
              <span>23:00</span>
              <span>02:00</span>
              <span>05:00</span>
              <span>08:00</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW M (Mois) & 6 M */}
      {(activeTab === "month" || activeTab === "sixMonth") && (
        <div className="space-y-3">
          {/* Header Metric: Average or Selected Day */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-start gap-6">
                <div>
                  <div className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
                    TEMPS MOY. PASSÉ AU LIT
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1 mt-0.5">
                    <span>{monthDays.avgInBedText.split(" ")[0]}</span>
                    <span className="text-xs font-semibold text-white/80">h</span>
                    <span>{monthDays.avgInBedText.split(" ")[2]}</span>
                    <span className="text-xs font-semibold text-white/80">min</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
                    DURÉE MOY. DU SOMMEIL
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1 mt-0.5">
                    <span>{monthDays.avgSleepText.split(" ")[0]}</span>
                    <span className="text-xs font-semibold text-white/80">h</span>
                    <span>{monthDays.avgSleepText.split(" ")[2]}</span>
                    <span className="text-xs font-semibold text-white/80">min</span>
                  </div>
                </div>
              </div>

              <div className="text-xs font-medium text-[#8E8E93]">
                {monthDays.dateRangeLabel}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDetailedData((v) => !v)}
              className="p-1 text-[#8E8E93] hover:text-white"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          {/* Month Multi-Bar Grid with 30 slender vertical bars */}
          <div className="relative w-full h-[280px] pt-4 pr-12 pb-6 pl-2">
            {/* Horizontal Grid lines */}
            {yAxisTicks.map((tick) => (
              <div
                key={tick.label}
                className="absolute left-2 right-12 flex items-center pointer-events-none"
                style={{ top: `${tick.topPct}%` }}
              >
                <div className="w-full border-b border-dashed border-[#2C2C2E]" />
                <span className="absolute right-[-44px] text-[11px] font-medium text-[#8E8E93] font-mono">
                  {tick.label}
                </span>
              </div>
            ))}

            {/* Vertical Bars for Month Days */}
            <div className="relative h-full flex justify-between items-stretch z-10 gap-[2px]">
              {monthDays.days.map((day) => {
                const isSelected = day.dateStr === (selectedDayStr || currentDateStr);

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setSelectedDayStr(day.dateStr);
                      onSelectDate?.(day.dateStr);
                    }}
                    className="relative flex-1 flex flex-col items-center justify-end cursor-pointer group"
                  >
                    {/* Vertical Hairline pointer when day is selected */}
                    {isSelected && (
                      <div className="absolute inset-y-0 w-px bg-white/40 pointer-events-none z-0" />
                    )}

                    {/* Slender bar */}
                    <div
                      className={cn(
                        "w-1.5 rounded-full transition-all shadow-sm",
                        isSelected ? "w-2 ring-1 ring-white" : ""
                      )}
                      style={{
                        top: `${day.topPct}%`,
                        height: `${day.heightPct}%`,
                        background: "linear-gradient(180deg, #7D7AFF 0%, #38BDF8 60%, #48486A 100%)",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Bottom Milestone Markers */}
            <div className="absolute bottom-0 left-2 right-12 flex justify-between text-[11px] font-bold text-[#8E8E93] font-mono">
              <span>6</span>
              <span>13</span>
              <span>20</span>
              <span>27</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. "AFFICHER PLUS DE DONNÉES SOMMEIL" BLUE LINK */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            if (onOpenEditModal) onOpenEditModal();
            else setIsEditModalOpen(true);
          }}
          className="text-sm font-bold text-[#0A84FF] hover:underline cursor-pointer"
        >
          Afficher plus de données Sommeil
        </button>
      </div>

      {/* 4. "VOTRE PROGRAMME" CARD */}
      <div className="space-y-3 pt-4">
        <h3 className="text-xl font-bold text-white tracking-tight pl-1">
          Votre programme
        </h3>

        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-5 shadow-lg space-y-4">
          <div className="text-xs font-bold text-[#0A84FF] tracking-wide uppercase">
            Suivant
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Coucher */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#8E8E93]">
                <Bed className="w-4 h-4 text-[#8E8E93]" />
                <span>COUCHER</span>
              </div>
              <div className="text-3xl font-black text-white font-mono tracking-tight">
                {scheduledBedtime}
              </div>
              <div className="text-xs text-[#8E8E93]">
                Ce soir
              </div>
            </div>

            {/* Réveil */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#8E8E93]">
                <Clock className="w-4 h-4 text-[#8E8E93]" />
                <span>RÉVEIL – AUCUNE ALARME</span>
              </div>
              <div className="text-3xl font-black text-white font-mono tracking-tight">
                {scheduledWakeTime}
              </div>
              <div className="text-xs text-[#8E8E93]">
                Aujourd&apos;hui
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (onOpenEditModal) onOpenEditModal();
                else setIsEditModalOpen(true);
              }}
              className="text-sm font-semibold text-[#0A84FF] hover:underline cursor-pointer"
            >
              Modifier
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenEditModal) onOpenEditModal();
                else setIsEditModalOpen(true);
              }}
              className="flex items-center gap-1 text-xs font-medium text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
            >
              <span>Programme complet et options</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sleep Session Edit Modal */}
      <SleepEditModal
        isOpen={isEditModalOpen}
        initialSession={{
          sessionType: "night",
          startDate: format(subDays(parseISO(selectedDayStr || currentDateStr), 1), "yyyy-MM-dd"),
          startTime: scheduledBedtime,
          endDate: selectedDayStr || currentDateStr,
          endTime: scheduledWakeTime,
        }}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
};
