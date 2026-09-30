"use client";

import React from "react";
import { Period } from "../types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  period: Period;
  onChangePeriod: (period: Period) => void;
  referenceDate: Date;
  onChangeReferenceDate: (date: Date) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  period,
  onChangePeriod,
  referenceDate,
  onChangeReferenceDate,
}) => {
  const options: { id: Period; label: string }[] = [
    { id: "day", label: "Jour" },
    { id: "week", label: "Semaine" },
    { id: "month", label: "Mois" },
    { id: "all", label: "Global" },
  ];

  const safeDate =
    referenceDate instanceof Date && !isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  const handlePrev = () => {
    if (period === "day") {
      onChangeReferenceDate(subDays(safeDate, 1));
    } else if (period === "week") {
      onChangeReferenceDate(subWeeks(safeDate, 1));
    } else if (period === "month") {
      onChangeReferenceDate(subMonths(safeDate, 1));
    }
  };

  const handleNext = () => {
    if (period === "day") {
      onChangeReferenceDate(addDays(safeDate, 1));
    } else if (period === "week") {
      onChangeReferenceDate(addWeeks(safeDate, 1));
    } else if (period === "month") {
      onChangeReferenceDate(addMonths(safeDate, 1));
    }
  };

  // Label for current navigated period
  let periodSubLabel = "";
  try {
    if (period === "day") {
      const formatted = format(safeDate, "EEEE d MMMM yyyy", { locale: fr });
      periodSubLabel = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } else if (period === "week") {
      const start = startOfWeek(safeDate, { weekStartsOn: 1 });
      const end = endOfWeek(safeDate, { weekStartsOn: 1 });
      periodSubLabel = `${format(start, "d MMM", { locale: fr })} - ${format(end, "d MMM yyyy", { locale: fr })}`;
    } else if (period === "month") {
      const formatted = format(safeDate, "MMMM yyyy", { locale: fr });
      periodSubLabel = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
  } catch {
    periodSubLabel = "—";
  }

  return (
    <div className="w-full space-y-2 overflow-hidden select-none">
      {/* Four main tabs: Jour | Semaine | Mois | Global */}
      <div className="flex items-center p-1 bg-[#1C1D22] border border-[#282A30] rounded-full w-full max-w-sm mx-auto shadow-inner overflow-hidden">
        {options.map((opt) => {
          const isSelected = period === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChangePeriod(opt.id)}
              className={cn(
                "flex-1 py-1.5 sm:py-2 px-1 sm:px-2.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer text-center truncate",
                isSelected
                  ? "bg-white text-black shadow-md font-bold"
                  : "text-[#8E929E] hover:text-white"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Period Navigation with Arrows for Jour, Semaine & Mois */}
      {period !== "all" && (
        <div className="flex items-center justify-between px-2 sm:px-3 py-1 bg-[#141518] border border-[#23242A] rounded-2xl w-full max-w-sm mx-auto text-xs font-bold text-white shadow-sm overflow-hidden">
          <button
            onClick={handlePrev}
            className="p-1 sm:p-1.5 rounded-xl text-[#D4F63D] hover:bg-[#20222A] transition-colors cursor-pointer shrink-0"
            title={period === "day" ? "Jour précédent" : period === "week" ? "Semaine précédente" : "Mois précédent"}
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <span className="capitalize text-[#E2E8F0] tracking-tight font-semibold text-[11px] sm:text-xs truncate px-1 text-center">
            {periodSubLabel}
          </span>

          <button
            onClick={handleNext}
            className="p-1 sm:p-1.5 rounded-xl text-[#D4F63D] hover:bg-[#20222A] transition-colors cursor-pointer shrink-0"
            title={period === "day" ? "Jour suivant" : period === "week" ? "Semaine suivante" : "Mois suivant"}
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
