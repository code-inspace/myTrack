"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Moon, Sparkles } from "lucide-react";
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

// Vertical scale anchor: 18:00 (top) to 18:00 the next day (bottom) — the full window is only
// used as a fallback when there's no data; otherwise it's cropped to the actual data ± 1h so the
// card isn't mostly empty scroll space.
const WINDOW_START_MINUTES = 18 * 60;
const WINDOW_SPAN_MINUTES = 24 * 60;
const RANGE_PADDING_MINUTES = 60;
const PX_PER_MINUTE = 0.4;
const MIN_TRACK_HEIGHT_PX = 160;
const MAX_TRACK_HEIGHT_PX = 420;
// Candidate spacings (minutes) for gridlines, tried in order until the range fits in ~6 lines —
// keeps labels on round clock marks (18:00 is itself a round hour) instead of arbitrary offsets.
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
  night: Segment | null;
  naps: Segment[];
}

export const SleepWaveChart: React.FC<SleepWaveChartProps> = ({
  period,
  referenceDate,
}) => {
  const FRENCH_DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const [syncVersion, setSyncVersion] = useState(0);
  const todayStr = getTodayDateString();

  // Sync historical sleep logs (bedtime/wakeTime/naps) from Supabase into the local cache
  useEffect(() => {
    const daysCount = period === "week" ? 7 : period === "month" ? 14 : 30;
    fetchSleepHistory(daysCount + 5).then((logs) => {
      if (logs && logs.length > 0) {
        setSyncVersion((v) => v + 1);
      }
    });
  }, [period, referenceDate]);

  const { points, validNights, averageText, trackHeightPx, axisLabels } = useMemo(() => {
    const daysCount = period === "week" ? 7 : period === "month" ? 14 : 30;
    const rawPts: Array<{ dateStr: string; label: string; night: RawSegment | null; naps: RawSegment[] }> = [];

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
        period === "week"
          ? `${FRENCH_DAYS_SHORT[dayIndex]} ${format(d, "d")}`
          : format(d, "d MMM", { locale: fr });

      let night: RawSegment | null = null;
      if (nightData) {
        totalMinutes += nightData.duration.hours * 60 + nightData.duration.minutes;
        nights++;
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
      const naps: RawSegment[] = (dayLog.naps || [])
        .filter((n) => n.endTime || isToday) // only show an ongoing (open) nap on today's column
        .map((n) => {
          const isOpen = !n.endTime;
          const effectiveEnd = n.endTime || `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
          const startOffset = offsetFromWindowStart(n.startTime);
          const endOffset = offsetFromWindowStart(effectiveEnd);
          const dur = computeSleepDuration(n.startTime, effectiveEnd);
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

      rawPts.push({ dateStr, label, night, naps });
    }

    // Crop the vertical scale to the actual data ± 1h instead of the full 18h-18h window, so
    // the card doesn't scroll through mostly-empty hours.
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

    const points: DayPoint[] = rawPts.map((pt) => ({
      dateStr: pt.dateStr,
      label: pt.label,
      night: pt.night ? toSegment(pt.night) : null,
      naps: pt.naps.map(toSegment),
    }));

    const trackHeightPx = Math.min(
      MAX_TRACK_HEIGHT_PX,
      Math.max(MIN_TRACK_HEIGHT_PX, Math.round(windowSpan * PX_PER_MINUTE))
    );

    // Snap gridlines to round clock marks within the (possibly cropped) window, rather than
    // evenly slicing the range into arbitrary, ugly offsets like "02:48".
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
      axisLabels.push({ offsetPct: ((offset - windowStart) / windowSpan) * 100, label: formatAxisLabel(offset) });
    }

    const averageText =
      nights > 0
        ? `${Math.floor(totalMinutes / nights / 60)}h ${String(
            Math.round((totalMinutes / nights) % 60)
          ).padStart(2, "0")}m`
        : "N/A";

    return { points, validNights: nights, averageText, trackHeightPx, axisLabels };
  }, [period, referenceDate, syncVersion, todayStr]);

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

      {/* Vertical Timeline: cropped to the actual sleep/nap data ± 1h, sleep/nap segments
          placed by time of day at a legible scale. */}
      <div className="pt-2">
        <div className="rounded-xl">
          <div
            className="flex items-stretch gap-1.5 pl-1 pr-9 relative"
            style={{ height: `${trackHeightPx}px` }}
          >
            {/* Horizontal time-of-day gridlines */}
            {axisLabels.map((axis, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-b border-dashed border-[#282A30] pointer-events-none flex items-center justify-end"
                style={{ top: `${axis.offsetPct}%` }}
              >
                <span className="text-[9px] font-mono text-[#6B7280] -mt-1.5 absolute -right-9">
                  {axis.label}
                </span>
              </div>
            ))}

            {points.map((pt, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center h-full min-w-0 group relative">
                <div className="relative w-full h-full rounded-xl bg-[#17181D]/60 border border-[#282A30] overflow-hidden">
                  {pt.night && (
                    <div
                      className="absolute inset-x-[15%] rounded-md bg-gradient-to-b from-[#818CF8] to-[#6366F1] group-hover:from-[#D4F63D] group-hover:to-[#a9d61f] transition-colors"
                      style={{ top: `${pt.night.topPct}%`, height: `${Math.max(pt.night.heightPct, 0.8)}%` }}
                      title={`${pt.night.startTime} → ${pt.night.endTime} (${pt.night.durationText})`}
                    />
                  )}
                  {pt.naps.map((nap, nIdx) => (
                    <div
                      key={nIdx}
                      className={cn(
                        "absolute inset-x-[25%] rounded-md bg-[#A5B4FC]/70 border border-[#A5B4FC]/50",
                        nap.isOpen && "animate-pulse"
                      )}
                      style={{ top: `${nap.topPct}%`, height: `${Math.max(nap.heightPct, 0.8)}%` }}
                      title={
                        nap.isOpen
                          ? `Sieste en cours depuis ${nap.startTime}`
                          : `Sieste ${nap.startTime} → ${nap.endTime} (${nap.durationText})`
                      }
                    />
                  ))}
                </div>

                {/* Tooltip on hover/touch — kept outside the clipped track so it isn't cut off */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-[#252830] text-white text-[10px] font-mono py-0.5 px-2 rounded-lg border border-[#343740] opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-30">
                  {pt.night ? `${pt.night.durationText} (${pt.night.startTime} → ${pt.night.endTime})` : "N/A"}
                </div>

                {/* Label */}
                <span className="text-[10px] font-medium text-[#8E929E] mt-2 truncate max-w-full">
                  {pt.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
