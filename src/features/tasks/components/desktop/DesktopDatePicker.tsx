"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  format,
  parseISO,
  addDays,
  subDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday as dfIsToday,
  isYesterday,
  isTomorrow,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTodayDateString } from "@/lib/dates";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

interface DesktopDatePickerProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
}

function getDateLabel(date: Date): string {
  if (dfIsToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return "Hier";
  if (isTomorrow(date)) return "Demain";
  // "Lundi 28 oct"
  return format(date, "EEEE d MMM", { locale: fr })
    .split(" ")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export const DesktopDatePicker: React.FC<DesktopDatePickerProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const todayStr = getTodayDateString();

  const currentDate = useMemo(() => {
    try { return parseISO(selectedDate); } catch { return new Date(); }
  }, [selectedDate]);

  const [viewMonth, setViewMonth] = useState<Date>(currentDate);

  // Sync viewMonth when dropdown closes or date changes externally
  useEffect(() => {
    if (!isOpen) setViewMonth(currentDate);
  }, [currentDate, isOpen]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const label = getDateLabel(currentDate);
  const isOnToday = selectedDate === todayStr;

  const handlePrev = () => onSelectDate(format(subDays(currentDate, 1), "yyyy-MM-dd"));
  const handleNext = () => onSelectDate(format(addDays(currentDate, 1), "yyyy-MM-dd"));
  const handleToday = () => { onSelectDate(todayStr); setIsOpen(false); };

  const calDays = useMemo(() => {
    const mStart = startOfMonth(viewMonth);
    const mEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

  const viewMonthLabel = (() => {
    const l = format(viewMonth, "MMMM yyyy", { locale: fr });
    return l.charAt(0).toUpperCase() + l.slice(1);
  })();

  return (
    <div className="relative flex items-center gap-2 select-none">
      {/* Prev arrow */}
      <button
        type="button"
        onClick={handlePrev}
        title="Jour précédent"
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#17181F] border border-[#282B36] text-[#8E929E] hover:text-white hover:bg-[#22242C] hover:border-[#383C48] transition-all cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Date label button — opens dropdown */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setViewMonth(currentDate); setIsOpen((v) => !v); }}
        className={cn(
          "h-9 min-w-[180px] px-4 flex items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all cursor-pointer",
          isOpen
            ? "bg-[#1E2029] border-[#D4F63D] text-white"
            : "bg-[#17181F] border-[#282B36] text-white hover:bg-[#1E2029] hover:border-[#383C48]"
        )}
        title="Ouvrir le calendrier"
      >
        <span className={cn(
          "transition-colors",
          dfIsToday(currentDate) ? "text-[#D4F63D]" : "text-white"
        )}>
          {label}
        </span>
        <ChevronLeft
          className={cn(
            "w-3.5 h-3.5 rotate-[-90deg] transition-transform duration-200",
            isOpen ? "rotate-90 text-[#D4F63D]" : "text-[#5C6070]"
          )}
        />
      </button>

      {/* Next arrow */}
      <button
        type="button"
        onClick={handleNext}
        title="Jour suivant"
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#17181F] border border-[#282B36] text-[#8E929E] hover:text-white hover:bg-[#22242C] hover:border-[#383C48] transition-all cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Today pill — shows only when not on today */}
      {!isOnToday && (
        <button
          type="button"
          onClick={handleToday}
          className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-[#D4F63D]/10 hover:bg-[#D4F63D]/20 text-[#D4F63D] border border-[#D4F63D]/30 text-xs font-bold transition-all cursor-pointer"
        >
          <RotateCcw className="w-3 h-3 stroke-[2.5]" />
          <span>Aujourd&apos;hui</span>
        </button>
      )}

      {/* Dropdown calendar */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 sm:hidden bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={dropdownRef}
            className="absolute top-11 left-0 z-50 w-[300px] bg-[#16181E] border border-[#2A2D38] rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Calendar header */}
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#252830]">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-white hover:bg-[#252830] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-sm font-extrabold text-white">{viewMonthLabel}</span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-white hover:bg-[#252830] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-white hover:bg-[#252830] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1.5">
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-[#5C6070] py-1">
                  {w}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calDays.map((day) => {
                const ds = format(day, "yyyy-MM-dd");
                const isSelected = isSameDay(day, currentDate);
                const isCurrentMonth = isSameMonth(day, viewMonth);
                const todayDay = dfIsToday(day);

                return (
                  <button
                    key={ds}
                    type="button"
                    onClick={() => { onSelectDate(ds); setIsOpen(false); }}
                    className={cn(
                      "h-9 w-full flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer relative",
                      isSelected
                        ? "bg-white text-black font-extrabold shadow-md scale-[1.05] z-10"
                        : todayDay
                        ? "bg-[#D4F63D]/15 text-[#D4F63D] font-bold border border-[#D4F63D]/40"
                        : isCurrentMonth
                        ? "text-[#D1D5DB] hover:bg-[#252830] hover:text-white"
                        : "text-[#3A3D4A] hover:bg-[#1E2028] opacity-40"
                    )}
                  >
                    <span>{format(day, "d")}</span>
                    {todayDay && !isSelected && (
                      <div className="w-1 h-1 rounded-full bg-[#D4F63D] -mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-2.5 border-t border-[#252830] flex items-center justify-between">
              <button
                type="button"
                onClick={handleToday}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#D4F63D] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                Aller à aujourd&apos;hui
              </button>
              <span className="text-[10px] text-[#5C6070]">
                {format(currentDate, "dd/MM/yyyy")}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
