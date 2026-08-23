"use client";

import React, { useState } from "react";
import { getWeekDaysForDate, getTodayDateString } from "@/lib/dates";
import { VerticalMonthCalendarModal } from "./VerticalMonthCalendarModal";
import { cn } from "@/lib/utils";
import { parseISO, format, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, RotateCcw } from "lucide-react";

interface HorizontalDatePickerProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
}

export const HorizontalDatePicker: React.FC<HorizontalDatePickerProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const todayStr = getTodayDateString();

  const currentDate = parseISO(selectedDate);
  const weekDays = getWeekDaysForDate(currentDate);

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: fr });
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const handlePrevWeek = () => {
    const prevWeekDate = subWeeks(currentDate, 1);
    onSelectDate(format(prevWeekDate, "yyyy-MM-dd"));
  };

  const handleNextWeek = () => {
    const nextWeekDate = addWeeks(currentDate, 1);
    onSelectDate(format(nextWeekDate, "yyyy-MM-dd"));
  };

  const handleGoToday = () => {
    onSelectDate(todayStr);
  };

  return (
    <div className="w-full px-2 py-1 select-none space-y-1">
      {/* Top Header: Month dropdown button + Prev/Next week navigation + Today button */}
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

        {/* Right side: Today Button (if not on today) + Week Chevrons */}
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
              onClick={handlePrevWeek}
              title="Semaine précédente"
              className="p-1 text-[#8E929E] hover:text-white hover:bg-[#252830] rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              title="Semaine suivante"
              className="p-1 text-[#8E929E] hover:text-white hover:bg-[#252830] rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Horizontal Week Strip */}
      <div className="w-full flex items-center justify-between gap-1 py-1">
        {weekDays.map((day) => {
          const isSelected = day.dateStr === selectedDate;

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => onSelectDate(day.dateStr)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer text-center",
                isSelected
                  ? "bg-[#252830] ring-1 ring-[#3a3e4c] shadow-lg scale-[1.04]"
                  : "hover:bg-[#1c1d22]/80 opacity-70 hover:opacity-100"
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
