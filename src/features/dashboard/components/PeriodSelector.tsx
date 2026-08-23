"use client";

import React from "react";
import { Period } from "../types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
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
    { id: "week", label: "Semaine" },
    { id: "month", label: "Mois" },
    { id: "all", label: "Tout le temps" },
  ];

  const handlePrev = () => {
    if (period === "week") {
      onChangeReferenceDate(subWeeks(referenceDate, 1));
    } else if (period === "month") {
      onChangeReferenceDate(subMonths(referenceDate, 1));
    }
  };

  const handleNext = () => {
    if (period === "week") {
      onChangeReferenceDate(addWeeks(referenceDate, 1));
    } else if (period === "month") {
      onChangeReferenceDate(addMonths(referenceDate, 1));
    }
  };

  // Label for current navigated period
  let periodSubLabel = "";
  if (period === "week") {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
    periodSubLabel = `${format(start, "d MMM", { locale: fr })} - ${format(end, "d MMM yyyy", { locale: fr })}`;
  } else if (period === "month") {
    const formatted = format(referenceDate, "MMMM yyyy", { locale: fr });
    periodSubLabel = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return (
    <div className="w-full space-y-2.5">
      {/* Three main tabs: Semaine | Mois | Tout le temps */}
      <div className="flex items-center p-1 bg-[#1C1D22] border border-[#282A30] rounded-full w-full max-w-sm mx-auto shadow-inner">
        {options.map((opt) => {
          const isSelected = period === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChangePeriod(opt.id)}
              className={cn(
                "flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer text-center",
                isSelected
                  ? "bg-white text-black shadow-md font-bold scale-[1.02]"
                  : "text-[#8E929E] hover:text-white"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Period Navigation with Arrows for Semaine & Mois */}
      {period !== "all" && (
        <div className="flex items-center justify-between px-3 py-1 bg-[#141518] border border-[#23242A] rounded-2xl max-w-sm mx-auto text-xs font-bold text-white shadow-sm">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-xl text-[#D4F63D] hover:bg-[#20222A] transition-colors cursor-pointer"
            title={period === "week" ? "Semaine précédente" : "Mois précédent"}
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <span className="capitalize text-[#E2E8F0] tracking-tight font-semibold">
            {periodSubLabel}
          </span>

          <button
            onClick={handleNext}
            className="p-1.5 rounded-xl text-[#D4F63D] hover:bg-[#20222A] transition-colors cursor-pointer"
            title={period === "week" ? "Semaine suivante" : "Mois suivant"}
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
