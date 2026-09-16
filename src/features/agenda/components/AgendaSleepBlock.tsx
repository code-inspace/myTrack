"use client";

import React from "react";
import { Moon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaSleepBlockProps {
  label: string;
  subLabel?: string;
  topOffsetPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
  isNap?: boolean;
  onClick?: () => void;
}

export const AgendaSleepBlock: React.FC<AgendaSleepBlockProps> = ({
  label,
  subLabel,
  topOffsetPx,
  heightPx,
  leftPercent,
  widthPercent,
  isNap = false,
  onClick,
}) => {
  const isSmall = heightPx < 45;

  return (
    <div
      onClick={onClick}
      style={{
        top: `${topOffsetPx}px`,
        height: `${heightPx}px`,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
      className={cn(
        "absolute z-10 px-2 py-1 rounded-xl border transition-all duration-150 select-none cursor-pointer group shadow-sm",
        isNap
          ? "bg-gradient-to-r from-[#1E293B]/90 to-[#182030]/90 border-[#A5B4FC]/40 hover:border-[#A5B4FC]/80 text-[#E0E7FF]"
          : "bg-gradient-to-r from-[#17192C]/92 to-[#121422]/92 border-[#818CF8]/45 hover:border-[#818CF8]/80 text-[#E0E7FF]"
      )}
      title={`${label} ${subLabel ? `(${subLabel})` : ""}`}
    >
      {/* Left Colored Stripe */}
      <div
        className={cn(
          "absolute left-0 inset-y-1.5 w-1 rounded-r-full shadow-[0_0_8px_rgba(129,140,248,0.5)]",
          isNap ? "bg-[#A5B4FC]" : "bg-[#818CF8]"
        )}
      />

      <div className="pl-1.5 flex flex-col justify-center h-full min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {isNap ? (
            <Sparkles className="w-3 h-3 text-[#A5B4FC] flex-shrink-0" />
          ) : (
            <Moon className="w-3 h-3 text-[#818CF8] flex-shrink-0" />
          )}
          <span className="text-[11px] font-bold text-white truncate tracking-tight">
            {label}
          </span>
          {subLabel && !isSmall && (
            <span className="text-[10px] font-medium text-[#D4F63D] font-mono truncate ml-auto">
              {subLabel}
            </span>
          )}
        </div>

        {subLabel && isSmall && (
          <span className="text-[9.5px] text-[#94A3B8] font-mono truncate">
            {subLabel}
          </span>
        )}

        {!isSmall && heightPx >= 55 && (
          <div className="text-[9.5px] text-[#94A3B8] truncate mt-0.5">
            {isNap ? "Temps de repos" : "Sommeil récupérateur"}
          </div>
        )}
      </div>
    </div>
  );
};
