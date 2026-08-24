"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { getTodayDateString } from "@/lib/dates";
import { VerticalMonthCalendarModal } from "./VerticalMonthCalendarModal";
import { cn } from "@/lib/utils";
import { parseISO, format, addDays, subDays, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, RotateCcw } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { cn as cnClass } from "@/lib/utils";

export const DAY_DROP_ID_PREFIX = "day-drop-";

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
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);
  const isFirstRender = useRef(true);

  const todayStr = getTodayDateString();
  const currentDate = useMemo(() => {
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: fr });
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Generate 120 days rolling window centered around today (-60 days to +60 days)
  const daysList = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 60);
    const end = addDays(today, 60);
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
  }, [todayStr]);

  // Smooth scroll selected day into center of horizontal strip
  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({
        behavior: isFirstRender.current ? "auto" : "smooth",
        inline: "center",
        block: "nearest",
      });
      isFirstRender.current = false;
    }
  }, [selectedDate]);

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
  };

  return (
    <div className="w-full px-2 py-1 select-none space-y-1.5">
      {/* Top Header: Month dropdown button + Prev/Next DAY navigation + Today button */}
      <div className="flex items-center justify-between px-1">
        {/* Clickable Month & Year with Chevron to toggle Vertical Month Calendar */}
        <button
          type="button"
          onClick={() => setIsMonthModalOpen(true)}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-[#1A1C22] hover:bg-[#252830] border border-[#2B2E38] text-xs font-bold text-white transition-all cursor-pointer shadow-sm group"
          title="Ouvrir le calendrier mensuel"
        >
          <Calendar className="w-3.5 h-3.5 text-[#D4F63D]" />
          <span>{capitalizedMonthLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#8E929E] group-hover:text-white transition-transform group-hover:translate-y-0.5" />
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
                "min-w-[50px] w-[50px] flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer text-center select-none",
                isSelected
                  ? "bg-[#252830] ring-1 ring-[#3a3e4c] shadow-lg scale-[1.04]"
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

      {/* Vertical Multi-Month Calendar Modal */}
      <VerticalMonthCalendarModal
        isOpen={isMonthModalOpen}
        selectedDate={selectedDate}
        onClose={() => setIsMonthModalOpen(false)}
        onSelectDate={onSelectDate}
      />
    </div>
  );
};
