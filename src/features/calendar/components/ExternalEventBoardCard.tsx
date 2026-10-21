"use client";

import React from "react";
import { ExternalCalendarEvent } from "../types";
import { getExternalEventStatus } from "../lib/status";
import { Clock, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/features/projects/hooks";

interface ExternalEventBoardCardProps {
  event: ExternalCalendarEvent;
  targetDateStr?: string;
  onClick?: () => void;
}

export const ExternalEventBoardCard: React.FC<ExternalEventBoardCardProps> = ({
  event,
  targetDateStr,
  onClick,
}) => {
  const { projects } = useProjects();
  const project = event.projectId ? projects.find((p) => p.id === event.projectId) : null;

  const status = getExternalEventStatus(event, targetDateStr);
  const isDone = status === "DONE";
  const isInProgress = status === "IN_PROGRESS";
  const calColor = event.calendarColor || "#3B82F6";

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl p-3 flex flex-col gap-1.5 transition-all select-none border cursor-pointer",
        isInProgress
          ? "bg-[#181D2A] border-[#3B82F6]/60 shadow-md ring-1 ring-[#3B82F6]/30"
          : isDone
          ? "bg-[#14151B] border-[#22242D] opacity-75"
          : "bg-[#1C1D22] border-[#282A30] hover:border-[#383B46]"
      )}
    >
      {project && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#D4F63D]">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.color || "#D4F63D" }}
          />
          <span className="truncate">{project.name}</span>
          {event.projectCategory && (
            <span className="text-[9px] text-[#A5B4FC] bg-[#818CF8]/15 border border-[#818CF8]/30 px-1 py-0.2 rounded font-semibold truncate">
              {event.projectCategory}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: calColor }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-wider truncate"
            style={{ color: calColor }}
          >
            {event.calendarName}
          </span>
        </div>

        {isInProgress && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-[#3B82F6]/20 text-[#60A5FA] border border-[#3B82F6]/40 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
            <span>EN COURS</span>
          </span>
        )}

        {isDone && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#D4F63D] px-1 rounded bg-[#D4F63D]/10">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
            <span>Fait</span>
          </span>
        )}
      </div>

      <h5
        className={cn(
          "text-xs font-bold text-white truncate",
          isDone && "line-through text-[#8E929E]"
        )}
      >
        {event.title}
      </h5>

      <div className="flex items-center gap-2 text-[10px] text-[#8E929E] flex-wrap mt-0.5">
        {event.startTime ? (
          <span className="inline-flex items-center gap-1 font-mono font-medium">
            <Clock className="w-2.5 h-2.5 text-[#D4F63D]" />
            <span>
              {event.startTime}
              {event.endTime ? ` - ${event.endTime}` : ""}
            </span>
          </span>
        ) : (
          <span className="font-medium text-[#9CA3AF]">Jour entier</span>
        )}

        {event.location && (
          <span className="inline-flex items-center gap-0.5 truncate max-w-[120px]">
            <MapPin className="w-2.5 h-2.5 text-[#CBD5E1]" />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </div>
    </div>
  );
};

