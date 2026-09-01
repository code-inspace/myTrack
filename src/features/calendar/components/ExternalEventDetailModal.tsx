"use client";

import React from "react";
import { ExternalCalendarEvent } from "../types";
import { X, Calendar, Clock, MapPin, AlignLeft, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface ExternalEventDetailModalProps {
  event: ExternalCalendarEvent | null;
  onClose: () => void;
}

export const ExternalEventDetailModal: React.FC<ExternalEventDetailModalProps> = ({
  event,
  onClose,
}) => {
  if (!event) return null;

  const calColor = event.calendarColor || "#3B82F6";

  const formattedDate = (() => {
    try {
      return format(parseISO(event.date), "EEEE d MMMM yyyy", { locale: fr });
    } catch {
      return event.date;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#15161C] border border-[#272A36] shadow-2xl p-6 text-white space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: calColor }}
            />
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border text-white" style={{ borderColor: `${calColor}40`, backgroundColor: `${calColor}15` }}>
              {event.calendarName}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8E929E] hover:text-white hover:bg-[#20222B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-xl font-bold text-white leading-snug">{event.title}</h3>
        </div>

        {/* Details Grid */}
        <div className="space-y-3 pt-1">
          {/* Date & Time */}
          <div className="flex items-center gap-3 text-sm text-[#D1D5DB]">
            <Calendar className="w-4 h-4 text-[#8E929E] flex-shrink-0" />
            <span className="capitalize">{formattedDate}</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-[#D1D5DB]">
            <Clock className="w-4 h-4 text-[#8E929E] flex-shrink-0" />
            <span>
              {event.isAllDay
                ? "Toute la journée"
                : `${event.startTime || "00:00"} - ${event.endTime || "00:00"}`}
            </span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3 text-sm text-[#D1D5DB]">
              <MapPin className="w-4 h-4 text-[#8E929E] flex-shrink-0 mt-0.5" />
              <span className="break-words">{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3 text-sm text-[#9CA3AF] pt-2 border-t border-[#252834]">
              <AlignLeft className="w-4 h-4 text-[#8E929E] flex-shrink-0 mt-0.5" />
              <p className="text-xs whitespace-pre-line leading-relaxed break-words text-[#D1D5DB]">
                {event.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#20222B] hover:bg-[#282B36] text-white text-xs font-bold transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
