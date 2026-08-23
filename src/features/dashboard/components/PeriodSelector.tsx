"use client";

import React from "react";
import { Period } from "../types";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  period: Period;
  onChange: (period: Period) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  period,
  onChange,
}) => {
  const options: { id: Period; label: string }[] = [
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
    { id: "all", label: "All time" },
  ];

  return (
    <div className="flex items-center p-1 bg-[#1C1D22] border border-[#282A30] rounded-full w-full max-w-sm mx-auto">
      {options.map((opt) => {
        const isSelected = period === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer text-center",
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
  );
};
