"use client";

import React from "react";
import { format, addMonths, subMonths, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaHeaderProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  onOpenNewTaskModal?: () => void;
}

const FRENCH_DAYS_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  selectedDate,
  onSelectDate,
  onOpenNewTaskModal,
}) => {
  const currentDate = parseISO(selectedDate);
  const monthLabel = format(currentDate, "MMMM yyyy", { locale: fr });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Generate the 7 days of the current selected week (starting Monday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: d,
      dateStr: format(d, "yyyy-MM-dd"),
      dayLetter: FRENCH_DAYS_LETTER[d.getDay()],
      dayNumber: d.getDate(),
      isToday: isSameDay(d, new Date()),
      isSelected: format(d, "yyyy-MM-dd") === selectedDate,
    };
  });

  const handlePrevMonth = () => {
    const prev = subMonths(currentDate, 1);
    onSelectDate(format(prev, "yyyy-MM-dd"));
  };

  const handleNextMonth = () => {
    const next = addMonths(currentDate, 1);
    onSelectDate(format(next, "yyyy-MM-dd"));
  };

  return (
    <div className="w-full bg-[#111214] text-white pt-2 pb-3 border-b border-[#23242A] select-none">
      {/* Top Bar: Month selector and actions (matching iOS Calendar screenshot) */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 text-[#D4F63D] hover:bg-[#1C1D22] rounded-full transition-all cursor-pointer"
            title="Mois précédent"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <span className="text-lg font-bold tracking-tight text-white capitalize">
            {capitalizedMonth}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 text-[#D4F63D] hover:bg-[#1C1D22] rounded-full transition-all cursor-pointer"
            title="Mois suivant"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="flex items-center gap-1 p-0.5 bg-[#1C1D22] rounded-full border border-[#2A2D35]">
            <a
              href="/tasks"
              className="px-2 py-0.5 text-[10px] font-medium text-[#8E929E] hover:text-white rounded-full transition-colors"
            >
              📋 Tâches
            </a>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#252830] text-white rounded-full shadow-sm">
              📅 Agenda
            </span>
            <a
              href="/history"
              className="px-2 py-0.5 text-[10px] font-medium text-[#8E929E] hover:text-white rounded-full transition-colors"
            >
              ⏳ Historique
            </a>
          </div>

          {onOpenNewTaskModal && (
            <button
              onClick={onOpenNewTaskModal}
              className="p-1.5 bg-[#1C1D22] hover:bg-[#282A30] text-[#D4F63D] rounded-full transition-all cursor-pointer border border-[#2A2D35]"
              title="Ajouter un événement / tâche"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Weekdays Row (L M M J V S D with dates matching iOS Calendar) */}
      <div className="grid grid-cols-7 gap-1 px-2">
        {weekDays.map((day) => (
          <button
            key={day.dateStr}
            onClick={() => onSelectDate(day.dateStr)}
            className="flex flex-col items-center justify-center py-1 cursor-pointer group"
          >
            <span
              className={cn(
                "text-[11px] font-bold tracking-wider uppercase mb-1.5 transition-colors",
                day.isSelected ? "text-white" : "text-[#8E929E]"
              )}
            >
              {day.dayLetter}
            </span>

            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200",
                day.isSelected
                  ? "bg-white text-black font-extrabold shadow-lg scale-105"
                  : day.isToday
                  ? "text-[#D4F63D] font-bold bg-[#D4F63D]/10 ring-1 ring-[#D4F63D]/40"
                  : "text-[#D1D5DB] hover:bg-[#1C1D22]"
              )}
            >
              {day.dayNumber}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
