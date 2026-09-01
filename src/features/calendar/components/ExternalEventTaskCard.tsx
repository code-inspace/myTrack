"use client";

import React from "react";
import { ExternalCalendarEvent } from "../types";
import { getExternalEventStatus } from "../lib/status";
import { Check, Calendar, MapPin, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ExternalEventTaskCardProps {
  event: ExternalCalendarEvent;
  selectedDate: string;
  isManuallyCompleted?: boolean;
  onToggleComplete?: () => void;
  onClick?: () => void;
}

export const ExternalEventTaskCard: React.FC<ExternalEventTaskCardProps> = ({
  event,
  selectedDate,
  isManuallyCompleted,
  onToggleComplete,
  onClick,
}) => {
  const status = getExternalEventStatus(event, selectedDate, isManuallyCompleted);
  const isDone = status === "DONE";
  const isInProgress = status === "IN_PROGRESS";
  const calColor = event.calendarColor || "#3B82F6";

  const handleCircleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDone) {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.8 },
        colors: [calColor, "#D4F63D", "#FFFFFF"],
      });
    }
    onToggleComplete?.();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-start justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all select-none cursor-pointer",
        isInProgress
          ? "bg-[#181C26] border-[#3B82F6]/60 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-[#3B82F6]/40"
          : isDone
          ? "bg-[#121316]/70 border-[#202229] opacity-70"
          : "bg-[#17181F] border-[#262833] hover:border-[#3A3D4D] hover:bg-[#1A1C24]"
      )}
    >
      {/* Left calendar color vertical accent strip */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
        style={{ backgroundColor: calColor }}
      />

      <div className="flex items-start gap-3 min-w-0 flex-1 pl-1.5">
        {/* Checkbox circle */}
        <button
          type="button"
          onClick={handleCircleClick}
          aria-label={isDone ? "Marquer comme à faire" : "Marquer comme fait"}
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 border-2 mt-0.5",
            isDone
              ? "bg-[#D4F63D] border-[#D4F63D] text-black shadow-sm"
              : isInProgress
              ? "border-[#3B82F6] bg-[#3B82F6]/15 text-[#3B82F6]"
              : "border-[#4E525F] hover:border-[#D4F63D] bg-transparent"
          )}
        >
          {isDone && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
          {isInProgress && !isDone && (
            <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-ping" />
          )}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={cn(
                "text-sm font-bold tracking-tight text-white transition-all truncate",
                isDone && "line-through text-[#8E929E]"
              )}
            >
              {event.title}
            </h4>

            {/* LIVE / EN COURS pulsing badge */}
            {isInProgress && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#3B82F6]/20 text-[#60A5FA] border border-[#3B82F6]/40 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
                <span>EN COURS</span>
              </span>
            )}

            {/* DONE badge */}
            {isDone && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#D4F63D]/10 text-[#D4F63D]/80 border border-[#D4F63D]/20">
                Terminé
              </span>
            )}
          </div>

          {/* Badges / Metadata */}
          <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[11px] text-[#8E929E]">
            {/* Time badge */}
            {event.startTime ? (
              <span className="inline-flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-lg bg-[#20222B] text-white border border-[#2D303E]">
                <Clock className="w-3 h-3 text-[#D4F63D]" />
                <span>
                  {event.startTime}
                  {event.endTime ? ` - ${event.endTime}` : ""}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-[#20222B] text-[#9CA3AF] border border-[#2D303E]">
                Jour entier
              </span>
            )}

            {/* Location badge */}
            {event.location && (
              <span className="inline-flex items-center gap-1 truncate max-w-[200px] text-[#CBD5E1]">
                <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: calColor }} />
                <span className="truncate">{event.location}</span>
              </span>
            )}

            {/* Calendar name badge */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
              style={{
                borderColor: `${calColor}40`,
                backgroundColor: `${calColor}15`,
                color: calColor,
              }}
            >
              <Calendar className="w-2.5 h-2.5" />
              <span>{event.calendarName}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
