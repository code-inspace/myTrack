"use client";

import React from "react";
import { ExternalCalendarEvent } from "../types";
import { getExternalEventStatus } from "../lib/status";
import { Check, Calendar, MapPin, Clock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProjects } from "@/features/projects/hooks";

interface ExternalEventTaskCardProps {
  event: ExternalCalendarEvent;
  selectedDate: string;
  isManuallyCompleted?: boolean;
  sortable?: boolean;
  onToggleComplete?: () => void;
  onClick?: () => void;
}

export const ExternalEventTaskCard: React.FC<ExternalEventTaskCardProps> = ({
  event,
  selectedDate,
  isManuallyCompleted,
  sortable = false,
  onToggleComplete,
  onClick,
}) => {
  const { projects } = useProjects();
  const project = event.projectId ? projects.find((p) => p.id === event.projectId) : null;

  const sortableId = event.id.startsWith("event_") ? event.id : `event_${event.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled: !sortable });

  const status = getExternalEventStatus(event, selectedDate, isManuallyCompleted);
  const isDone = status === "DONE";
  const isInProgress = status === "IN_PROGRESS";
  const calColor = project?.color || event.calendarColor || "#3B82F6";

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
      ref={setNodeRef}
      style={{
        touchAction: "pan-y",
        transform: CSS.Transform.toString(transform),
        transition,
        ...(project?.color && !isDragging
          ? {
              backgroundColor: isDone ? `${project.color}0D` : `${project.color}0F`,
              borderColor: isDone ? `${project.color}30` : `${project.color}45`,
            }
          : {}),
      }}
      onClick={onClick}
      className={cn(
        "group relative flex items-start justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 select-none cursor-pointer touch-pan-y shadow-sm",
        isDragging
          ? "opacity-40 border-[#D4F63D] scale-[0.98] ring-2 ring-[#D4F63D]/50 bg-[#22242B]"
          : isInProgress
          ? "bg-[#181C26] border-[#3B82F6]/60 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-[#3B82F6]/40"
          : isDone
          ? project
            ? "opacity-80 hover:brightness-110"
            : "bg-[#121316]/70 border-[#202229] opacity-70"
          : !project
          ? "bg-[#17181F] border-[#262833] hover:border-[#3A3D4D] hover:bg-[#1A1C24]"
          : "hover:brightness-110"
      )}
    >
      {/* Left calendar color vertical accent strip */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
        style={{ backgroundColor: calColor }}
      />

      <div className="flex items-start gap-2.5 min-w-0 flex-1 pl-1">
        {/* Reordering Drag Handle */}
        {sortable && (
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="p-1 -ml-1 text-[#6B7280] hover:text-[#D4F63D] cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors mt-0.5 touch-none"
            title="Glisser pour réorganiser"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Checkbox circle */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={handleCircleClick}
          aria-label={isDone ? "Marquer comme à faire" : "Marquer comme fait"}
          style={
            isDone && project?.color
              ? { backgroundColor: project.color, borderColor: project.color }
              : undefined
          }
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 border-2 mt-0.5",
            isDone
              ? project?.color
                ? "text-black shadow-sm"
                : "bg-[#D4F63D] border-[#D4F63D] text-black shadow-sm"
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
          {project && (
            <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm"
                style={{ backgroundColor: project.color || "#D4F63D" }}
              />
              <span className="text-[#D4F63D] font-bold truncate max-w-[160px]">
                {project.name}
              </span>
              {event.projectCategory && (
                <span className="text-[10px] text-[#A5B4FC] bg-[#818CF8]/15 border border-[#818CF8]/30 px-1.5 py-0.2 rounded-md font-semibold truncate max-w-[120px]">
                  {event.projectCategory}
                </span>
              )}
            </div>
          )}

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
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border"
                style={
                  project?.color
                    ? { color: project.color, backgroundColor: `${project.color}15`, borderColor: `${project.color}30` }
                    : { color: "rgba(212, 246, 61, 0.8)", backgroundColor: "rgba(212, 246, 61, 0.1)", borderColor: "rgba(212, 246, 61, 0.2)" }
                }
              >
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

            {/* Project badge */}
            {project && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                style={{
                  borderColor: `${project.color || "#D4F63D"}40`,
                  backgroundColor: `${project.color || "#D4F63D"}15`,
                  color: project.color || "#D4F63D",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color || "#D4F63D" }}
                />
                <span className="truncate max-w-[110px]">{project.name}</span>
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
