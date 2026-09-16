"use client";

import React from "react";
import { ExternalCalendarEvent } from "../types";
import { MapPin, Calendar, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/features/projects/hooks";

interface ExternalEventBlockProps {
  event: ExternalCalendarEvent;
  topOffsetPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
  onClick?: () => void;
}

export const ExternalEventBlock: React.FC<ExternalEventBlockProps> = ({
  event,
  topOffsetPx,
  heightPx,
  leftPercent,
  widthPercent,
  onClick,
}) => {
  const { projects } = useProjects();
  const project = event.projectId ? projects.find((p) => p.id === event.projectId) : null;

  const isShort = heightPx < 40;
  const calColor = project?.color || event.calendarColor || "#3B82F6";

  return (
    <div
      data-agenda-block="true"
      data-event-id={event.id}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "absolute rounded-xl p-2 z-15 transition-all select-none overflow-hidden cursor-pointer",
        "border backdrop-blur-md shadow-sm hover:z-25 hover:brightness-110 hover:shadow-lg",
        "group flex flex-col justify-between"
      )}
      style={{
        top: `${topOffsetPx}px`,
        height: `${heightPx}px`,
        left: `calc(${leftPercent}% + 1px)`,
        width: `calc(${widthPercent}% - 3px)`,
        backgroundColor: `${calColor}18`, // 10% opacity background
        borderColor: `${calColor}40`, // 25% opacity border
      }}
    >
      {/* Top row: Title + Time & Calendar badge */}
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: calColor }}
          />
          <h5 className="text-xs font-bold text-white truncate leading-tight">
            {event.title}
          </h5>
          {project && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: project.color || "#D4F63D" }}
              title={`Projet: ${project.name}`}
            />
          )}
        </div>

        {event.startTime && (
          <span
            className="text-[10px] font-mono font-semibold flex-shrink-0 px-1 py-0.2 rounded"
            style={{ color: calColor, backgroundColor: `${calColor}20` }}
          >
            {event.startTime}
            {event.endTime ? ` - ${event.endTime}` : ""}
          </span>
        )}
      </div>

      {/* Bottom details if height permits */}
      {!isShort && (
        <div className="flex items-center justify-between gap-1 text-[10px] text-[#9CA3AF] mt-1 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5 truncate">
            {project && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-black/40 text-white font-medium text-[9px] border border-white/10 truncate max-w-[100px]">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color || "#D4F63D" }}
                />
                <span className="truncate">{project.name}</span>
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-0.5 truncate text-[#D1D5DB]">
                <MapPin className="w-2.5 h-2.5 flex-shrink-0" style={{ color: calColor }} />
                <span className="truncate">{event.location}</span>
              </span>
            )}
          </div>

          <span
            className="text-[9px] font-medium px-1.5 py-0.2 rounded-full border text-white/80 whitespace-nowrap"
            style={{ borderColor: `${calColor}30`, backgroundColor: `${calColor}15` }}
          >
            {event.calendarName}
          </span>
        </div>
      )}
    </div>
  );
};

