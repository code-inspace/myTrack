"use client";

import React from "react";
import { ExternalCalendarEvent } from "../types";
import { X, Calendar, Clock, MapPin, AlignLeft, ExternalLink, Video } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface ExternalEventDetailModalProps {
  event: ExternalCalendarEvent | null;
  onClose: () => void;
}

// Helper to safely format text and render auto-linked URLs
function renderTextWithClickableLinks(text: string) {
  if (!text) return null;

  // Regex to match URLs (http, https)
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#60A5FA] hover:text-[#93C5FD] underline font-medium break-all inline-flex items-center gap-1 transition-colors"
        >
          <span>{part}</span>
          <ExternalLink className="w-3 h-3 inline-block flex-shrink-0" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function isUrl(str?: string | null): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("webcal://");
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

  const isLocationUrl = isUrl(event.location);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-[#14151C] border border-[#262836] shadow-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222430] flex-shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: calColor }}
            />
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full border truncate max-w-[200px]"
              style={{ borderColor: `${calColor}40`, backgroundColor: `${calColor}15`, color: calColor }}
            >
              {event.calendarName}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#8E929E] hover:text-white hover:bg-[#20222B] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
          {/* Title */}
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug break-words">
              {event.title}
            </h3>
          </div>

          {/* Time & Date Badges */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-[#E5E7EB]">
              <div className="w-7 h-7 rounded-lg bg-[#1F212C] border border-[#2D303E] flex items-center justify-center text-[#9CA3AF] flex-shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="capitalize font-semibold">{formattedDate}</span>
            </div>

            <div className="flex items-center gap-3 text-xs sm:text-sm text-[#E5E7EB]">
              <div className="w-7 h-7 rounded-lg bg-[#1F212C] border border-[#2D303E] flex items-center justify-center text-[#9CA3AF] flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold font-mono text-xs">
                {event.isAllDay
                  ? "Toute la journée"
                  : `${event.startTime || "00:00"} - ${event.endTime || "00:00"}`}
              </span>
            </div>

            {/* Location / Video Call Link */}
            {event.location && (
              <div className="p-3 rounded-2xl bg-[#1A1B24] border border-[#292C3A] space-y-2">
                <div className="flex items-start gap-2.5 text-xs text-[#D1D5DB]">
                  {isLocationUrl ? (
                    <Video className="w-4 h-4 text-[#38BDF8] flex-shrink-0 mt-0.5" />
                  ) : (
                    <MapPin className="w-4 h-4 text-[#F87171] flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1 break-words">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8E929E] block mb-0.5">
                      {isLocationUrl ? "Lien de visioconférence" : "Lieu"}
                    </span>
                    <div className="text-xs">{renderTextWithClickableLinks(event.location)}</div>
                  </div>
                </div>

                {isLocationUrl && (
                  <a
                    href={event.location.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full mt-1.5 py-2 px-3 rounded-xl bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 border border-[#3B82F6]/40 text-[#60A5FA] font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Rejoindre la réunion</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Description Section */}
          {event.description && (
            <div className="pt-3 border-t border-[#222430] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#8E929E] uppercase tracking-wider">
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Description</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#161720] border border-[#262836] text-xs text-[#D1D5DB] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {renderTextWithClickableLinks(event.description)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-[#222430] bg-[#101117] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#20222C] hover:bg-[#2A2D3A] text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
