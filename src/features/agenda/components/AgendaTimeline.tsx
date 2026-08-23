"use client";

import React, { useRef, useEffect, useState } from "react";
import { TaskWithCompletion } from "@/features/tasks/types";
import { AgendaTaskBlock } from "./AgendaTaskBlock";
import { isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface AgendaTimelineProps {
  selectedDate: string; // "YYYY-MM-DD"
  tasks: TaskWithCompletion[];
  onToggleComplete: (taskId: string) => void;
  onMoveTaskToTime: (taskId: string, startTime: string, endTime: string) => void;
  onDragStartTask: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onSelectTask?: (task: TaskWithCompletion) => void;
}

const HOUR_ROW_HEIGHT = 60; // 60px per hour -> 1px per minute
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 9 * 60; // Default 09:00
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutesToTime(totalMins: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export const AgendaTimeline: React.FC<AgendaTimelineProps> = ({
  selectedDate,
  tasks,
  onToggleComplete,
  onMoveTaskToTime,
  onDragStartTask,
  onSelectTask,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const isToday = isSameDay(parseISO(selectedDate), new Date());

  // Scroll to current hour or 08:00 on initial load
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetHour = isToday ? Math.max(0, Math.floor(currentTimeMinutes / 60) - 1) : 7;
      scrollContainerRef.current.scrollTop = targetHour * HOUR_ROW_HEIGHT;
    }
  }, [selectedDate, isToday, currentTimeMinutes]);

  // Keep live time indicator fresh
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleDragOverHour = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    setDragOverHour(hour);
  };

  const handleDropOnHour = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    let durationMins = 60; // Default 1 hour duration

    if (task?.startTime && task?.endTime) {
      const s = parseTimeToMinutes(task.effectiveStartTime || task.startTime);
      const end = parseTimeToMinutes(task.effectiveEndTime || task.endTime);
      durationMins = Math.max(30, end - s);
    }

    const newStartMins = hour * 60;
    const newEndMins = newStartMins + durationMins;

    onMoveTaskToTime(
      taskId,
      formatMinutesToTime(newStartMins),
      formatMinutesToTime(newEndMins)
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto relative bg-[#0E0F12] select-none scroll-smooth pb-24"
    >
      {/* 24-Hour Grid Container */}
      <div className="relative min-h-[1440px] flex">
        {/* Left Hours Column (00:00 -> 23:00 matching screenshot) */}
        <div className="w-16 flex-shrink-0 border-r border-[#202228] bg-[#111214]/50 z-20">
          {HOURS.map((hour) => (
            <div
              key={hour}
              style={{ height: `${HOUR_ROW_HEIGHT}px` }}
              className="text-right pr-2 text-[11px] font-mono font-medium text-[#717684] flex items-start justify-end pt-1"
            >
              <span>{hour.toString().padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        {/* Right Timeline Grid Column */}
        <div className="flex-1 relative">
          {/* Background Hour Lines & Drop Targets */}
          {HOURS.map((hour) => {
            const isHovered = dragOverHour === hour;

            return (
              <div
                key={hour}
                onDragOver={(e) => handleDragOverHour(e, hour)}
                onDragLeave={() => setDragOverHour(null)}
                onDrop={(e) => handleDropOnHour(e, hour)}
                style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                className={cn(
                  "border-b border-[#1A1C22] relative transition-colors duration-150",
                  isHovered ? "bg-[#D4F63D]/10 ring-1 ring-[#D4F63D] ring-inset" : "hover:bg-[#15171C]/40"
                )}
              >
                {/* Half-hour subtle dashed line */}
                <div className="absolute inset-x-0 top-1/2 border-b border-[#16181E]/60 border-dashed" />
              </div>
            );
          })}

          {/* Current Live Time Red Line (matching iOS Calendar) */}
          {isToday && (
            <div
              style={{ top: `${currentTimeMinutes}px` }}
              className="absolute inset-x-0 z-30 flex items-center pointer-events-none"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] -ml-1.5 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <div className="flex-1 border-b-2 border-[#EF4444] shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
            </div>
          )}

          {/* Timed Task Blocks placed absolutely */}
          {tasks.map((task) => {
            const startTimeStr = task.effectiveStartTime || task.startTime;
            if (!startTimeStr) return null; // All day tasks are rendered in AllDaySection

            const startMins = parseTimeToMinutes(startTimeStr);
            const endTimeStr = task.effectiveEndTime || task.endTime;
            const endMins = endTimeStr
              ? parseTimeToMinutes(endTimeStr)
              : startMins + 60; // Default 1h duration

            const durationMins = Math.max(30, endMins - startMins);

            return (
              <AgendaTaskBlock
                key={task.id}
                task={task}
                topOffsetPx={startMins}
                heightPx={durationMins}
                onToggleComplete={onToggleComplete}
                onDragStart={onDragStartTask}
                onClick={() => onSelectTask?.(task)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
