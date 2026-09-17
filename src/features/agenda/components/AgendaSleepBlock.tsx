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
  variant?: "objective" | "saved";
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
  variant = "saved",
  onClick,
}) => {
  const isSmall = heightPx < 45;
  const isObjective = variant === "objective";

  return (
    <div
      data-agenda-block="true"
      data-sleep-block="true"
      onClick={onClick}
      style={{
        top: `${topOffsetPx}px`,
        height: `${heightPx}px`,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
      className={cn(
        "absolute z-10 px-2 py-1 rounded-xl border transition-all duration-150 select-none cursor-pointer group shadow-sm",
        isObjective
          ? "bg-[#181A22]/90 hover:bg-[#222530]/95 border-[#475569]/50 hover:border-[#64748B]/80 text-[#CBD5E1]"
          : isNap
          ? "bg-gradient-to-r from-[#201538]/92 to-[#170E28]/92 border-[#A855F7]/50 hover:border-[#C084FC]/80 text-[#F3E8FF] shadow-[0_2px_10px_rgba(168,85,247,0.15)]"
          : "bg-gradient-to-r from-[#2A144E]/94 to-[#1B0D33]/94 border-[#8B5CF6]/55 hover:border-[#A855F7]/90 text-[#F3E8FF] shadow-[0_2px_12px_rgba(139,92,246,0.2)]"
      )}
      title={`${label} ${subLabel ? `(${subLabel})` : ""}${isObjective ? " - Objectif programmé" : " - Enregistré en base"}`}
    >
      {/* Left Colored Stripe */}
      <div
        className={cn(
          "absolute left-0 inset-y-1.5 w-1 rounded-r-full",
          isObjective
            ? "bg-[#64748B] shadow-[0_0_6px_rgba(100,116,139,0.4)]"
            : isNap
            ? "bg-[#C084FC] shadow-[0_0_8px_rgba(192,132,252,0.6)]"
            : "bg-[#A855F7] shadow-[0_0_10px_rgba(168,85,247,0.7)]"
        )}
      />

      <div className="pl-1.5 flex flex-col justify-center h-full min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {isObjective ? (
            <Moon className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />
          ) : isNap ? (
            <Sparkles className="w-3 h-3 text-[#C084FC] flex-shrink-0" />
          ) : (
            <Moon className="w-3 h-3 text-[#C084FC] flex-shrink-0" />
          )}
          <span
            className={cn(
              "text-[11px] truncate tracking-tight",
              isObjective ? "font-semibold text-[#E2E8F0]" : "font-bold text-white"
            )}
          >
            {label}
          </span>
          {subLabel && !isSmall && (
            <span
              className={cn(
                "text-[10px] font-mono truncate ml-auto",
                isObjective
                  ? "font-medium text-[#94A3B8]"
                  : "font-bold text-[#D4F63D]"
              )}
            >
              {subLabel}
            </span>
          )}
        </div>

        {subLabel && isSmall && (
          <span
            className={cn(
              "text-[9.5px] font-mono truncate",
              isObjective ? "text-[#64748B]" : "text-[#C4B5FD]"
            )}
          >
            {subLabel}
          </span>
        )}

        {!isSmall && heightPx >= 55 && (
          <div
            className={cn(
              "text-[9.5px] truncate mt-0.5",
              isObjective ? "text-[#64748B]" : "text-[#C4B5FD] font-medium"
            )}
          >
            {isObjective
              ? "Objectif programmé"
              : isNap
              ? "Sieste enregistrée"
              : "Sommeil enregistré"}
          </div>
        )}
      </div>
    </div>
  );
};
