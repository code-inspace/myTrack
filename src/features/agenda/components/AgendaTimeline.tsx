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
  onToggleReminder?: (taskId: string) => void;
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
  const normalized = Math.max(0, Math.min(23 * 60 + 55, totalMins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export const AgendaTimeline: React.FC<AgendaTimelineProps> = ({
  selectedDate,
  tasks,
  onToggleComplete,
  onToggleReminder,
  onMoveTaskToTime,
  onDragStartTask,
  onSelectTask,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragHoverMinute, setDragHoverMinute] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [resizingState, setResizingState] = useState<{
    taskId: string;
    startMins: number;
    currentHeight: number;
  } | null>(null);

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

  // Calculate 5-minute snapped minute from drag position
  const getSnappedMinuteFromEvent = (e: React.DragEvent) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalMinutes = offsetY; // 1px = 1 min
    const snapped = Math.round(totalMinutes / 5) * 5;
    return Math.max(0, Math.min(23 * 60 + 55, snapped));
  };

  const handleGridDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const snappedMins = getSnappedMinuteFromEvent(e);
    setDragHoverMinute(snappedMins);
  };

  const handleGridDragLeave = () => {
    setDragHoverMinute(null);
  };

  const handleGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const snappedStartMins = getSnappedMinuteFromEvent(e);
    setDragHoverMinute(null);

    const taskId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    let durationMins = 60; // Default 1 hour duration

    if (task?.startTime && task?.endTime) {
      const s = parseTimeToMinutes(task.effectiveStartTime || task.startTime);
      const end = parseTimeToMinutes(task.effectiveEndTime || task.endTime);
      durationMins = Math.max(15, end - s);
    }

    const snappedEndMins = snappedStartMins + durationMins;

    onMoveTaskToTime(
      taskId,
      formatMinutesToTime(snappedStartMins),
      formatMinutesToTime(snappedEndMins)
    );
  };

  // Interactive Duration Resize Pointer Handler (5-min precision)
  const handleStartResize = (e: React.PointerEvent, task: TaskWithCompletion) => {
    e.preventDefault();
    const startMins = parseTimeToMinutes(task.effectiveStartTime || task.startTime || "09:00");
    const endMins = parseTimeToMinutes(task.effectiveEndTime || task.endTime || "10:00");
    const initialHeight = Math.max(15, endMins - startMins);

    const startY = e.clientY;
    setResizingState({ taskId: task.id, startMins, currentHeight: initialHeight });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const rawHeight = initialHeight + deltaY;
      const snappedDuration = Math.max(10, Math.round(rawHeight / 5) * 5);
      setResizingState({ taskId: task.id, startMins, currentHeight: snappedDuration });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      const deltaY = upEvent.clientY - startY;
      const rawHeight = initialHeight + deltaY;
      const finalDuration = Math.max(10, Math.round(rawHeight / 5) * 5);
      const finalEndMins = startMins + finalDuration;

      onMoveTaskToTime(
        task.id,
        formatMinutesToTime(startMins),
        formatMinutesToTime(finalEndMins)
      );

      setResizingState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      ref={scrollContainerRef}
      onClick={() => setSelectedTaskId(null)}
      className="flex-1 overflow-y-auto relative bg-[#0E0F12] select-none scroll-smooth pb-28"
    >
      {/* 24-Hour Grid Container */}
      <div className="relative min-h-[1440px] flex">
        {/* Left Hours Column (00:00 -> 23:00) */}
        <div className="w-16 flex-shrink-0 border-r border-[#202228] bg-[#111214]/60 z-20 sticky left-0">
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

        {/* Right Timeline Grid Column (Drop Target with 5-min granularity) */}
        <div
          ref={gridRef}
          onDragOver={handleGridDragOver}
          onDragLeave={handleGridDragLeave}
          onDrop={handleGridDrop}
          className="flex-1 relative"
        >
          {/* Background Hour Lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              style={{ height: `${HOUR_ROW_HEIGHT}px` }}
              className="border-b border-[#1A1C22] relative"
            >
              {/* Half-hour subtle dashed line */}
              <div className="absolute inset-x-0 top-1/2 border-b border-[#16181E]/60 border-dashed" />
            </div>
          ))}

          {/* 5-Min Drag Hover Indicator with Live Snapped Time Tooltip */}
          {dragHoverMinute !== null && (
            <div
              style={{ top: `${dragHoverMinute}px` }}
              className="absolute inset-x-0 z-40 pointer-events-none flex items-center"
            >
              <div className="bg-[#D4F63D] text-black font-mono font-extrabold text-[10px] py-0.5 px-2 rounded-full shadow-lg ml-1">
                ⏱ {formatMinutesToTime(dragHoverMinute)} (5 min)
              </div>
              <div className="flex-1 border-b-2 border-dashed border-[#D4F63D]" />
            </div>
          )}

          {/* Current Live Time Red Line */}
          {isToday && (
            <div
              style={{ top: `${currentTimeMinutes}px` }}
              className="absolute inset-x-0 z-30 flex items-center pointer-events-none"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] -ml-1.5 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <div className="flex-1 border-b-2 border-[#EF4444] shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
            </div>
          )}

          {/* Timed Task Blocks */}
          {tasks.map((task) => {
            const startTimeStr = task.effectiveStartTime !== undefined ? task.effectiveStartTime : task.startTime;
            if (!startTimeStr) return null;

            const startMins = parseTimeToMinutes(startTimeStr);
            const endTimeStr = task.effectiveEndTime !== undefined ? task.effectiveEndTime : task.endTime;
            const endMins = endTimeStr
              ? parseTimeToMinutes(endTimeStr)
              : startMins + 60;

            const defaultDuration = Math.max(15, endMins - startMins);
            const isCurrentlyResizing = resizingState?.taskId === task.id;
            const activeHeight = isCurrentlyResizing
              ? resizingState.currentHeight
              : defaultDuration;

            return (
              <AgendaTaskBlock
                key={task.id}
                task={task}
                topOffsetPx={startMins}
                heightPx={activeHeight}
                isSelected={selectedTaskId === task.id || isCurrentlyResizing}
                onToggleComplete={onToggleComplete}
                onToggleReminder={onToggleReminder}
                onDragStart={onDragStartTask}
                onClick={() => {
                  setSelectedTaskId(task.id);
                  onSelectTask?.(task);
                }}
                onStartResize={handleStartResize}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
