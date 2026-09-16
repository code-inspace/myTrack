"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getStoredSleepLog,
  computeSleepDuration,
  getNightSleepDuration,
  fetchSleepHistory,
} from "@/features/sleep/actions";
import { getTodayDateString } from "@/lib/dates";
import { Period } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

interface SleepWaveChartProps {
  period: Period;
  referenceDate: Date;
}

// Vertical scale anchor: 18:00 (top) to 18:00 the next day (bottom)
const WINDOW_START_MINUTES = 18 * 60;
const WINDOW_SPAN_MINUTES = 24 * 60;
const RANGE_PADDING_MINUTES = 60;
const PX_PER_MINUTE = 0.42;
const MIN_TRACK_HEIGHT_PX = 180;
const MAX_TRACK_HEIGHT_PX = 420;
const AXIS_STEP_CANDIDATES_MIN = [30, 60, 120, 180, 240];

function offsetFromWindowStart(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  const minutes = h * 60 + m;
  return ((minutes - WINDOW_START_MINUTES) % WINDOW_SPAN_MINUTES + WINDOW_SPAN_MINUTES) % WINDOW_SPAN_MINUTES;
}

function formatAxisLabel(offsetMinutes: number): string {
  const minutes = (WINDOW_START_MINUTES + offsetMinutes) % (24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface RawSegment {
  startOffset: number;
  endOffset: number;
  startTime: string;
  endTime: string;
  durationText: string;
  isOpen?: boolean;
}

interface Segment {
  topPct: number;
  heightPct: number;
  startTime: string;
  endTime: string;
  durationText: string;
  isOpen?: boolean;
}

interface DayPoint {
  dateStr: string;
  label: string;
  fullDateLabel: string;
  night: Segment | null;
  naps: Segment[];
  yesterdayBedtime: string | null;
  todayWakeTime: string | null;
  nightDurationText: string | null;
  totalNapMinutes: number;
  totalNapText: string;
  napsCount: number;
  totalDaySleepText: string;
}

export const SleepWaveChart: React.FC<SleepWaveChartProps> = ({
  period,
  referenceDate,
}) => {
  const FRENCH_DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const [syncVersion, setSyncVersion] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const todayStr = getTodayDateString();

  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Sync historical sleep logs (bedtime/wakeTime/naps) from Supabase into the local cache
  useEffect(() => {
    const daysCount = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 60;
    fetchSleepHistory(daysCount + 5).then((logs) => {
      if (logs && logs.length > 0) {
        setSyncVersion((v) => v + 1);
      }
    });
  }, [period, referenceDate]);

  const { points, validNights, averageText, trackHeightPx, axisLabels } = useMemo(() => {
    const daysCount = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 60;
    const rawPts: Array<{
      dateStr: string;
      label: string;
      fullDateLabel: string;
      night: RawSegment | null;
      naps: RawSegment[];
      yesterdayBedtime: string | null;
      todayWakeTime: string | null;
      nightDurationText: string | null;
      totalNapMinutes: number;
      totalNapText: string;
      napsCount: number;
      totalDaySleepMinutes: number;
    }> = [];

    let totalMinutes = 0;
    let nights = 0;
    let rangeMin = Infinity;
    let rangeMax = -Infinity;

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = subDays(referenceDate, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const nightData = getNightSleepDuration(dateStr);
      const dayLog = getStoredSleepLog(dateStr);

      const dayIndex = d.getDay();
      const label =
        period === "day"
          ? format(d, "EEEE d", { locale: fr })
          : period === "week"
          ? FRENCH_DAYS_SHORT[dayIndex]
          : format(d, "d MMM", { locale: fr });

      const fullDateLabel = format(d, "EEEE d MMMM", { locale: fr });

      let night: RawSegment | null = null;
      let yesterdayBedtime: string | null = null;
      let todayWakeTime: string | null = null;
      let nightDurationText: string | null = null;
      let nightMinutes = 0;

      if (nightData) {
        nightMinutes = nightData.duration.hours * 60 + nightData.duration.minutes;
        totalMinutes += nightMinutes;
        nights++;
        yesterdayBedtime = nightData.yesterdayBedtime;
        todayWakeTime = nightData.todayWakeTime;
        nightDurationText = nightData.duration.text;

        const startOffset = offsetFromWindowStart(nightData.yesterdayBedtime);
        const endOffset = offsetFromWindowStart(nightData.todayWakeTime);
        night = {
          startOffset,
          endOffset,
          startTime: nightData.yesterdayBedtime,
          endTime: nightData.todayWakeTime,
          durationText: nightData.duration.text,
        };
        rangeMin = Math.min(rangeMin, startOffset);
        rangeMax = Math.max(rangeMax, endOffset);
      }

      const isToday = dateStr === todayStr;
      let dayNapMinutes = 0;

      const naps: RawSegment[] = (dayLog.naps || [])
        .filter((n) => n.endTime || isToday)
        .map((n) => {
          const isOpen = !n.endTime;
          const effectiveEnd =
            n.endTime ||
            `${String(new Date().getHours()).padStart(2, "0")}:${String(
              new Date().getMinutes(),
            ).padStart(2, "0")}`;
          const startOffset = offsetFromWindowStart(n.startTime);
          const endOffset = offsetFromWindowStart(effectiveEnd);
          const dur = computeSleepDuration(n.startTime, effectiveEnd);

          if (dur) {
            dayNapMinutes += dur.hours * 60 + dur.minutes;
          }

          rangeMin = Math.min(rangeMin, startOffset);
          rangeMax = Math.max(rangeMax, endOffset);
          return {
            startOffset,
            endOffset,
            startTime: n.startTime,
            endTime: effectiveEnd,
            durationText: dur?.text || "",
            isOpen,
          };
        });

      const totalNapText =
        dayNapMinutes >= 60
          ? `${Math.floor(dayNapMinutes / 60)}h ${String(dayNapMinutes % 60).padStart(2, "0")}m`
          : `${dayNapMinutes} min`;

      const totalDaySleepMinutes = nightMinutes + dayNapMinutes;

      rawPts.push({
        dateStr,
        label,
        fullDateLabel,
        night,
        naps,
        yesterdayBedtime,
        todayWakeTime,
        nightDurationText,
        totalNapMinutes: dayNapMinutes,
        totalNapText,
        napsCount: naps.length,
        totalDaySleepMinutes,
      });
    }

    // Crop vertical scale to actual data ± 1h
    let windowStart = 0;
    let windowSpan = WINDOW_SPAN_MINUTES;
    if (rangeMin !== Infinity) {
      const paddedStart = Math.max(0, rangeMin - RANGE_PADDING_MINUTES);
      const paddedEnd = Math.min(WINDOW_SPAN_MINUTES, rangeMax + RANGE_PADDING_MINUTES);
      windowStart = paddedStart;
      windowSpan = Math.max(paddedEnd - paddedStart, RANGE_PADDING_MINUTES * 2);
    }

    const toSegment = (raw: RawSegment): Segment => ({
      topPct: ((raw.startOffset - windowStart) / windowSpan) * 100,
      heightPct: (Math.max(raw.endOffset - raw.startOffset, 0) / windowSpan) * 100,
      startTime: raw.startTime,
      endTime: raw.endTime,
      durationText: raw.durationText,
      isOpen: raw.isOpen,
    });

    const points: DayPoint[] = rawPts.map((pt) => {
      const totalH = Math.floor(pt.totalDaySleepMinutes / 60);
      const totalM = pt.totalDaySleepMinutes % 60;
      const totalDaySleepText =
        pt.totalDaySleepMinutes > 0
          ? `${totalH}h ${String(totalM).padStart(2, "0")}m`
          : "0 min";

      return {
        dateStr: pt.dateStr,
        label: pt.label,
        fullDateLabel: pt.fullDateLabel,
        night: pt.night ? toSegment(pt.night) : null,
        naps: pt.naps.map(toSegment),
        yesterdayBedtime: pt.yesterdayBedtime,
        todayWakeTime: pt.todayWakeTime,
        nightDurationText: pt.nightDurationText,
        totalNapMinutes: pt.totalNapMinutes,
        totalNapText: pt.totalNapText,
        napsCount: pt.napsCount,
        totalDaySleepText,
      };
    });

    const trackHeightPx = Math.min(
      MAX_TRACK_HEIGHT_PX,
      Math.max(MIN_TRACK_HEIGHT_PX, Math.round(windowSpan * PX_PER_MINUTE)),
    );

    const step =
      AXIS_STEP_CANDIDATES_MIN.find((s) => windowSpan / s <= 6) ??
      AXIS_STEP_CANDIDATES_MIN[AXIS_STEP_CANDIDATES_MIN.length - 1];
    const windowEnd = windowStart + windowSpan;
    const axisLabels: Array<{ offsetPct: number; label: string }> = [];
    for (
      let offset = Math.ceil(windowStart / step) * step;
      offset <= windowEnd;
      offset += step
    ) {
      axisLabels.push({
        offsetPct: ((offset - windowStart) / windowSpan) * 100,
        label: formatAxisLabel(offset),
      });
    }

    const averageText =
      nights > 0
        ? `${Math.floor(totalMinutes / nights / 60)}h ${String(
            Math.round((totalMinutes / nights) % 60),
          ).padStart(2, "0")}m`
        : "N/A";

    return { points, validNights: nights, averageText, trackHeightPx, axisLabels };
  }, [period, referenceDate, syncVersion, todayStr]);

  // Find currently selected point (or fallback to latest point with data)
  const activeSelectedPoint = useMemo(() => {
    if (selectedDateStr) {
      const found = points.find((p) => p.dateStr === selectedDateStr);
      if (found) return found;
    }
    // Default to the most recent night with data, or the last point
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].night || points[i].naps.length > 0) {
        return points[i];
      }
    }
    return points[points.length - 1] || null;
  }, [points, selectedDateStr]);

  // Autoscroll to the latest days (right side) when period is month or all
  useEffect(() => {
    if (period !== "week" && period !== "day" && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [period, points]);

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
              <span>Sommeil par nuit</span>
            </h3>
            <p className="text-[11px] text-[#8E929E]">
              Moyenne : <strong className="text-[#D4F63D]">{averageText}</strong>
              {validNights > 0 ? " / nuit" : ""}
            </p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#818CF8] text-[11px] font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          <span>Objectif 8h</span>
        </div>
      </div>

      {/* Selected Day Detail Card: Bedtime, Wake Time & Nap Duration */}
      {activeSelectedPoint && (
        <div className="bg-[#17181D] border border-[#2A2D37] rounded-2xl p-3.5 space-y-2.5 transition-all animate-in fade-in duration-200">
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
              <span className="text-[11px] text-[#8E929E]">
                Pas de nuit enregistrée
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
                {activeSelectedPoint.yesterdayBedtime || "--:--"}
              </span>
            </div>

            {/* Réveil */}
            <div className="bg-[#202229] border border-[#2D303C] rounded-xl p-2 flex flex-col">
              <span className="text-[10px] font-medium text-[#8E929E] flex items-center gap-1">
                <Sun className="w-3 h-3 text-[#FBBF24]" /> Réveil
              </span>
              <span className="text-xs font-mono font-bold text-white mt-0.5">
                {activeSelectedPoint.todayWakeTime || "--:--"}
              </span>
            </div>

            {/* Siestes */}
            <div className="bg-[#202229] border border-[#2D303C] rounded-xl p-2 flex flex-col">
              <span className="text-[10px] font-medium text-[#8E929E] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#A5B4FC]" /> Sieste{activeSelectedPoint.napsCount > 1 ? "s" : ""}
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

      {/* Vertical Timeline Chart Frame with Internal Hour Marks */}
      <div className="pt-1">
        <div
          ref={scrollContainerRef}
          className={cn(
            "relative w-full rounded-2xl bg-[#141519] border border-[#282A30] p-3 select-none",
            period === "week" || period === "day"
              ? "overflow-hidden"
              : "overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-[#282A30]"
          )}
        >
          {/* Day columns */}
          <div
            className={cn(
              "flex items-stretch relative z-10",
              period === "day"
                ? "w-full justify-center"
                : period === "week"
                ? "w-full gap-1.5"
                : "min-w-max gap-2 pr-2"
            )}
          >
            {points.map((pt, idx) => {
              const isSelected = activeSelectedPoint?.dateStr === pt.dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDateStr(pt.dateStr)}
                  className={cn(
                    "flex flex-col items-center group relative cursor-pointer",
                    period === "day"
                      ? "w-24 sm:w-32"
                      : period === "week"
                      ? "flex-1 min-w-0"
                      : "w-9 sm:w-11 flex-shrink-0"
                  )}
                >
                  {/* Track Bar area */}
                  <div
                    className={cn(
                      "relative w-full rounded-xl transition-all overflow-hidden",
                      isSelected
                        ? "bg-[#1C1D24] border-2 border-[#818CF8] shadow-lg ring-2 ring-[#818CF8]/20"
                        : "bg-[#17181D]/60 border border-[#282A30] hover:border-[#4B5563]",
                    )}
                    style={{ height: `${trackHeightPx}px` }}
                  >
                    {pt.night && (
                      <div
                        className={cn(
                          "absolute inset-x-[15%] rounded-md transition-colors",
                          isSelected
                            ? "bg-gradient-to-b from-[#818CF8] to-[#6366F1] ring-1 ring-white/30"
                            : "bg-gradient-to-b from-[#818CF8] to-[#6366F1] group-hover:from-[#D4F63D] group-hover:to-[#a9d61f]",
                        )}
                        style={{
                          top: `${pt.night.topPct}%`,
                          height: `${Math.max(pt.night.heightPct, 1.5)}%`,
                        }}
                      />
                    )}
                    {pt.naps.map((nap, nIdx) => (
                      <div
                        key={nIdx}
                        className={cn(
                          "absolute inset-x-[25%] rounded-md bg-[#A5B4FC]/80 border border-[#A5B4FC]/50",
                          nap.isOpen && "animate-pulse",
                        )}
                        style={{
                          top: `${nap.topPct}%`,
                          height: `${Math.max(nap.heightPct, 1.5)}%`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Date Label under each column */}
                  <span
                    className={cn(
                      "text-[10px] mt-2 truncate max-w-full transition-colors text-center",
                      isSelected
                        ? "font-bold text-[#818CF8]"
                        : "font-medium text-[#8E929E] group-hover:text-white",
                    )}
                  >
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Horizontal time-of-day gridlines with labels INSIDE the chart frame */}
          <div
            className="absolute inset-x-3 top-3 pointer-events-none z-0"
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
