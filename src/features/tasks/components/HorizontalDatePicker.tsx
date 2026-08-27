"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { getTodayDateString } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  parseISO,
  format,
  addDays,
  subDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, RotateCcw, X } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { cn as cnClass } from "@/lib/utils";

export const DAY_DROP_ID_PREFIX = "day-drop-";

const WEEKDAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

interface HorizontalDatePickerProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
  /** true while a habit card is being dragged, to hint that days accept drops */
  isDragActive?: boolean;
}

const DayDropTarget: React.FC<{ dateStr: string; isDragActive?: boolean; children: React.ReactNode }> = ({
  dateStr,
  isDragActive,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `${DAY_DROP_ID_PREFIX}${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      className={cnClass(
        "flex-shrink-0 rounded-2xl transition-all",
        isOver ? "ring-2 ring-[#D4F63D] scale-105" : isDragActive ? "ring-1 ring-[#D4F63D]/30" : ""
      )}
    >
      {children}
    </div>
  );
};

export const HorizontalDatePicker: React.FC<HorizontalDatePickerProps> = ({
  selectedDate,
  onSelectDate,
  isDragActive,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);
  const isFirstRender = useRef(true);

  const todayStr = getTodayDateString();
  const todayDate = useMemo(() => new Date(), []);

  const currentDate = useMemo(() => {
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  // The month currently viewed in the dropdown calendar
  const [viewMonth, setViewMonth] = useState<Date>(() => currentDate);

  // Sync viewMonth when selectedDate changes and dropdown is closed
  useEffect(() => {
    if (!isDropdownOpen) {
      setViewMonth(currentDate);
    }
  }, [currentDate, isDropdownOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: fr });
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const dropdownMonthLabel = format(viewMonth, "MMMM yyyy", { locale: fr });
  const capitalizedDropdownMonthLabel = dropdownMonthLabel.charAt(0).toUpperCase() + dropdownMonthLabel.slice(1);

  // Generate dynamic rolling window centered around selectedDate and today
  const daysList = useMemo(() => {
    const today = new Date();
    const minDate = currentDate < today ? currentDate : today;
    const maxDate = currentDate > today ? currentDate : today;
    const start = subDays(minDate, 45);
    const end = addDays(maxDate, 45);
    const intervalDays = eachDayOfInterval({ start, end });

    return intervalDays.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayName = format(d, "EEE", { locale: fr }).toUpperCase().replace(".", "");
      const dayNumber = format(d, "d");
      const isToday = dateStr === todayStr;

      return {
        dateStr,
        dayName,
        dayNumber,
        isToday,
      };
    });
  }, [todayStr, currentDate]);

  // Smooth scroll selected day into center of horizontal strip without viewport jitter
  useEffect(() => {
    if (scrollContainerRef.current && selectedButtonRef.current) {
      const container = scrollContainerRef.current;
      const target = selectedButtonRef.current;
      const scrollPos = target.offsetLeft - (container.clientWidth / 2) + (target.offsetWidth / 2);

      container.scrollTo({
        left: Math.max(0, scrollPos),
        behavior: isFirstRender.current ? "auto" : "smooth",
      });
      isFirstRender.current = false;
    }
  }, [selectedDate]);

  // Days for month dropdown grid
  const monthCalendarDays = useMemo(() => {
    const mStart = startOfMonth(viewMonth);
    const mEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

  // Chevrons navigate DAY by DAY (+1 day / -1 day)
  const handlePrevDay = () => {
    const prevDate = subDays(currentDate, 1);
    onSelectDate(format(prevDate, "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    const nextDate = addDays(currentDate, 1);
    onSelectDate(format(nextDate, "yyyy-MM-dd"));
  };

  const handleGoToday = () => {
    onSelectDate(todayStr);
    setViewMonth(new Date());
    setIsDropdownOpen(false);
  };

  const handleSelectDropdownDay = (day: Date) => {
    const formatted = format(day, "yyyy-MM-dd");
    onSelectDate(formatted);
    setIsDropdownOpen(false);
  };

  return (
    <div className="relative w-full px-2 py-1 select-none space-y-1.5">
      {/* Top Header: Month dropdown button + Prev/Next DAY navigation + Today button */}
      <div className="flex items-center justify-between px-1">
        {/* Clickable Month & Year with Chevron to toggle Dropdown Calendar */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            setViewMonth(currentDate);
            setIsDropdownOpen((prev) => !prev);
          }}
          className={cn(
            "flex items-center gap-1.5 py-1 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm group",
            isDropdownOpen
              ? "bg-[#252830] border-[#D4F63D] text-[#D4F63D]"
              : "bg-[#1A1C22] hover:bg-[#252830] border-[#2B2E38] text-white"
          )}
          title="Ouvrir le sélecteur de calendrier"
        >
          <CalendarIcon className={cn("w-3.5 h-3.5", isDropdownOpen ? "text-[#D4F63D]" : "text-[#D4F63D]")} />
          <span>{capitalizedMonthLabel}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200",
              isDropdownOpen ? "rotate-180 text-[#D4F63D]" : "text-[#8E929E] group-hover:text-white"
            )}
          />
        </button>

        {/* Right side: Today Button (if not on today) + Day Chevrons (-1j / +1j) */}
        <div className="flex items-center gap-1.5">
          {selectedDate !== todayStr && (
            <button
              type="button"
              onClick={handleGoToday}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#D4F63D] hover:bg-[#c2e432] text-black font-extrabold text-[11px] shadow-sm transition-all cursor-pointer animate-in fade-in duration-150"
            >
              <RotateCcw className="w-3 h-3 stroke-[3]" />
              <span>Aujourd'hui</span>
            </button>
          )}

          <div className="flex items-center p-0.5 bg-[#1A1C22] border border-[#2B2E38] rounded-xl">
            <button
              type="button"
              onClick={handlePrevDay}
              title="Jour précédent (-1 jour)"
              className="p-1 text-[#8E929E] hover:text-white hover:bg-[#252830] rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              title="Jour suivant (+1 jour)"
              className="p-1 text-[#8E929E] hover:text-white hover:bg-[#252830] rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Dropdown Month Calendar */}
      {isDropdownOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] sm:hidden"
            onClick={() => setIsDropdownOpen(false)}
          />

          <div
            ref={dropdownRef}
            className="absolute left-1 top-10 z-50 w-[300px] sm:w-[320px] p-3 bg-[#16181E] border border-[#2F333E] rounded-2xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Dropdown Header: Prev/Next Month & Today Shortcut */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#252830]">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="p-1 text-[#8E929E] hover:text-white hover:bg-[#252830] rounded-lg transition-colors cursor-pointer"
                title="Mois précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-extrabold text-white capitalize">
                {capitalizedDropdownMonthLabel}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  className="p-1 text-[#8E929E] hover:text-white hover:bg-[#252830] rounded-lg transition-colors cursor-pointer"
                  title="Mois suivant"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="p-1 text-[#8E929E] hover:text-white hover:bg-[#252830] rounded-lg transition-colors cursor-pointer ml-1"
                  title="Fermer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Weekdays row */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#8E929E] mb-1.5">
              {WEEKDAYS_SHORT.map((w, idx) => (
                <div key={idx} className="py-0.5">
                  {w}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {monthCalendarDays.map((day) => {
                const isSelected = isSameDay(day, currentDate);
                const isToday = isSameDay(day, todayDate);
                const isCurrentViewMonth = isSameMonth(day, viewMonth);
                const dayNum = format(day, "d");

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelectDropdownDay(day)}
                    className={cn(
                      "h-8 rounded-xl flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer relative",
                      isSelected
                        ? "bg-white text-black font-extrabold shadow-md scale-105 z-10"
                        : isToday
                        ? "bg-[#D4F63D]/20 text-[#D4F63D] font-bold border border-[#D4F63D]/50"
                        : isCurrentViewMonth
                        ? "text-[#E5E7EB] hover:bg-[#252830]"
                        : "text-[#4B5162] hover:bg-[#1E2028] opacity-40"
                    )}
                  >
                    <span>{dayNum}</span>
                    {isToday && !isSelected && (
                      <div className="w-1 h-1 rounded-full bg-[#D4F63D] -mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick footer with Today shortcut */}
            <div className="mt-2.5 pt-2 border-t border-[#252830] flex items-center justify-between">
              <button
                type="button"
                onClick={handleGoToday}
                className="text-[11px] font-bold text-[#D4F63D] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                <span>Aller à aujourd'hui</span>
              </button>
              <span className="text-[10px] text-[#6B7280]">
                {format(currentDate, "dd/MM/yyyy")}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Freely Scrollable Horizontal Days Strip */}
      <div
        ref={scrollContainerRef}
        className="w-full flex items-center gap-1.5 py-1 overflow-x-auto scrollbar-none touch-pan-x overscroll-x-contain"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {daysList.map((day) => {
          const isSelected = day.dateStr === selectedDate;

          return (
            <DayDropTarget key={day.dateStr} dateStr={day.dateStr} isDragActive={isDragActive}>
              <button
                ref={isSelected ? selectedButtonRef : null}
                type="button"
                onClick={() => onSelectDate(day.dateStr)}
                className={cn(
                  "min-w-[50px] w-[50px] flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-colors cursor-pointer text-center select-none",
                  isSelected
                    ? "bg-[#252830] ring-1 ring-[#3a3e4c] shadow-md"
                    : "hover:bg-[#1c1d22]/80 opacity-70 hover:opacity-100 bg-[#16171C]/50"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight uppercase mb-1",
                    isSelected ? "text-white" : "text-[#8E929E]"
                  )}
                >
                  {day.dayName}
                </span>

                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    isSelected
                      ? "bg-white text-black shadow-md"
                      : day.isToday
                      ? "text-[#D4F63D] font-extrabold bg-[#D4F63D]/10 border border-[#D4F63D]/40"
                      : "text-[#D1D5DB]"
                  )}
                >
                  {day.dayNumber}
                </div>

                {/* Indicator dot */}
                <div className="h-1 mt-1 flex items-center justify-center">
                  {isSelected ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4F63D]" />
                  ) : day.isToday ? (
                    <div className="w-1 h-1 rounded-full bg-[#8E929E]" />
                  ) : null}
                </div>
              </button>
            </DayDropTarget>
          );
        })}
      </div>
    </div>
  );
};
