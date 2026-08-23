"use client";

import React from "react";
import { getWeekDaysForDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { parseISO } from "date-fns";

interface HorizontalDatePickerProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
}

export const HorizontalDatePicker: React.FC<HorizontalDatePickerProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const currentDate = parseISO(selectedDate);
  const weekDays = getWeekDaysForDate(currentDate);

  return (
    <div className="w-full flex items-center justify-between gap-1.5 py-3 px-1">
      {weekDays.map((day) => {
        const isSelected = day.dateStr === selectedDate;

        return (
          <button
            key={day.dateStr}
            onClick={() => onSelectDate(day.dateStr)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl transition-all duration-200 cursor-pointer text-center",
              isSelected
                ? "bg-[#252830] ring-1 ring-[#3a3e4c] shadow-lg scale-[1.04]"
                : "hover:bg-[#1c1d22]/80 opacity-70 hover:opacity-100"
            )}
          >
            <span
              className={cn(
                "text-[11px] font-medium tracking-tight uppercase mb-1.5",
                isSelected ? "text-white font-semibold" : "text-[#8E929E]"
              )}
            >
              {day.dayName}
            </span>

            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                isSelected
                  ? "bg-white text-black shadow-md"
                  : day.isToday
                  ? "text-[#D4F63D] font-bold"
                  : "text-[#D1D5DB]"
              )}
            >
              {day.dayNumber}
            </div>

            {/* Small active indicator pill underneath selected day */}
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
  );
};
