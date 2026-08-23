"use client";

import React, { useEffect, useRef } from "react";
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Calendar as CalendarIcon, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTodayDateString } from "@/lib/dates";

interface VerticalMonthCalendarModalProps {
  isOpen: boolean;
  selectedDate: string; // "YYYY-MM-DD"
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export const VerticalMonthCalendarModal: React.FC<VerticalMonthCalendarModalProps> = ({
  isOpen,
  selectedDate,
  onClose,
  onSelectDate,
}) => {
  const todayStr = getTodayDateString();
  const todayDate = new Date();
  const currentSelected = parseISO(selectedDate);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeMonthRef = useRef<HTMLDivElement>(null);

  // Generate range of 12 months (3 in the past, current, 8 in future)
  const months: Date[] = [];
  const baseMonth = startOfMonth(todayDate);
  for (let i = -3; i <= 8; i++) {
    months.push(addMonths(baseMonth, i));
  }

  useEffect(() => {
    if (isOpen && activeMonthRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        activeMonthRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectDay = (dayDate: Date) => {
    const formatted = format(dayDate, "yyyy-MM-dd");
    onSelectDate(formatted);
    onClose();
  };

  const handleGoToday = () => {
    onSelectDate(todayStr);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#16181D] border border-[#282B34] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] h-[80vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252830] flex-shrink-0 bg-[#121316]">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#D4F63D]" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Calendrier annuel
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={handleGoToday}
                className="px-3 py-1 rounded-full bg-[#D4F63D] hover:bg-[#c2e432] text-black font-extrabold text-xs transition-all cursor-pointer shadow-sm"
              >
                Aujourd'hui
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#252830] text-[#8E929E] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sticky Weekday header */}
        <div className="grid grid-cols-7 gap-1 px-4 py-2 bg-[#1A1C23] border-b border-[#252830] text-center text-xs font-bold text-[#8E929E] flex-shrink-0">
          {WEEKDAYS.map((w, idx) => (
            <div key={idx}>{w}</div>
          ))}
        </div>

        {/* Vertically Scrollable Months List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 divide-y divide-[#252830]/50 scroll-smooth"
        >
          {months.map((month) => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
            const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

            const days: Date[] = [];
            let curr = startDate;
            while (curr <= endDate) {
              days.push(curr);
              curr = addDays(curr, 1);
            }

            const isCurrentSelectedMonth = isSameMonth(month, currentSelected);
            const monthLabel = format(month, "MMMM yyyy", { locale: fr });
            const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

            return (
              <div
                key={month.toISOString()}
                ref={isCurrentSelectedMonth ? activeMonthRef : undefined}
                className="pt-4 first:pt-0"
              >
                {/* Month title */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-sm font-extrabold text-white tracking-tight">
                    {capitalizedMonthLabel}
                  </h4>
                  {isSameMonth(month, todayDate) && (
                    <span className="text-[10px] font-bold text-[#D4F63D] bg-[#D4F63D]/10 px-2 py-0.5 rounded-full border border-[#D4F63D]/30">
                      Mois en cours
                    </span>
                  )}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {days.map((day) => {
                    const isSelected = isSameDay(day, currentSelected);
                    const isToday = isSameDay(day, todayDate);
                    const isThisMonth = isSameMonth(day, month);
                    const dayFormatted = format(day, "d");

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => handleSelectDay(day)}
                        className={cn(
                          "h-10 rounded-xl flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer relative",
                          isSelected
                            ? "bg-white text-black font-extrabold shadow-lg scale-105 z-10"
                            : isToday
                            ? "bg-[#D4F63D]/20 text-[#D4F63D] font-bold border border-[#D4F63D]/50"
                            : isThisMonth
                            ? "text-[#E5E7EB] hover:bg-[#252830]"
                            : "text-[#4B5162] hover:bg-[#1E2028] opacity-50"
                        )}
                      >
                        <span>{dayFormatted}</span>
                        {isToday && !isSelected && (
                          <div className="w-1 h-1 rounded-full bg-[#D4F63D] mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
