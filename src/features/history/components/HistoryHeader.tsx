"use client";

import React from "react";
import { format, subDays, addDays, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, History as HistoryIcon, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryHeaderProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const currentDate = parseISO(selectedDate);
  const formattedDisplay = format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
  const isCurrentDay = isToday(currentDate);

  const handlePrevDay = () => {
    const prev = subDays(currentDate, 1);
    onSelectDate(format(prev, "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    const next = addDays(currentDate, 1);
    onSelectDate(format(next, "yyyy-MM-dd"));
  };

  return (
    <div className="w-full bg-[#111214] text-white py-3 px-4 border-b border-[#23242A]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#20222A] flex items-center justify-center text-[#D4F63D]">
            <HistoryIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Historique & Réalisation</h2>
            <p className="text-[11px] text-[#8E929E]">Comparatif Prévu vs Réalisé</p>
          </div>
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
            <a
              href="/agenda"
              className="px-2 py-0.5 text-[10px] font-medium text-[#8E929E] hover:text-white rounded-full transition-colors"
            >
              📅 Agenda
            </a>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#252830] text-white rounded-full shadow-sm">
              ⏳ Historique
            </span>
          </div>

          {/* Date Selector Quick Input */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            className="bg-[#1C1D22] text-xs text-[#D1D5DB] px-2 py-1 rounded-xl border border-[#282A30] outline-none focus:border-[#D4F63D]"
          />
        </div>
      </div>

      {/* Date navigation bar */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1C1D22]">
        <button
          onClick={handlePrevDay}
          className="flex items-center gap-1 text-xs font-semibold text-[#8E929E] hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-[#1C1D22]"
        >
          <ChevronLeft className="w-4 h-4" />
          Jour précédent
        </button>

        <span className="text-xs font-bold capitalize text-[#D4F63D]">
          {isCurrentDay ? "Aujourd'hui, " : ""}
          {formattedDisplay}
        </span>

        <button
          onClick={handleNextDay}
          className="flex items-center gap-1 text-xs font-semibold text-[#8E929E] hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-[#1C1D22]"
        >
          Jour suivant
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
