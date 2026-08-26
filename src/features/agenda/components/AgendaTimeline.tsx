"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Task, TaskWithCompletion, TaskCompletion } from "@/features/tasks/types";
import { AgendaTaskBlock } from "./AgendaTaskBlock";
import { isSameDay, parseISO, addDays, startOfWeek, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isTaskScheduledForDate, getTodayDateString } from "@/lib/dates";
import { mapTaskWithCompletion } from "@/features/tasks/mappers";

export type AgendaViewMode = "day" | "3days" | "week";

interface AgendaTimelineProps {
  selectedDate: string; // "YYYY-MM-DD"
  tasks: TaskWithCompletion[];
  allTasks?: Task[];
  allCompletions?: TaskCompletion[];
  onSelectDate?: (date: string) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
  onMoveTaskToTime: (taskId: string, startTime: string, endTime: string, date?: string) => void;
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

export function computeTasksForDate(
  dateStr: string,
  allTasks: Task[],
  allCompletions: TaskCompletion[]
): TaskWithCompletion[] {
  const date = parseISO(dateStr);
  const todayStr = getTodayDateString();

  return allTasks
    .filter((task) => !task.isArchived)
    .filter((task) => {
      if (task.recurrence === "ONCE") {
        const originalDate = task.createdAt
          ? task.createdAt.split("T")[0]
          : todayStr;

        const isCompletedOnThisDate = allCompletions.some(
          (c) => c.taskId === task.id && c.date === dateStr && c.completed
        );
        if (isCompletedOnThisDate) return true;

        const isCompletedOnOtherDate = allCompletions.some(
          (c) => c.taskId === task.id && c.completed && c.date !== dateStr
        );
        if (isCompletedOnOtherDate) return false;

        if (dateStr < todayStr) return false;
        if (dateStr === todayStr) return originalDate <= todayStr;
        return originalDate === dateStr;
      }

      const scheduled = isTaskScheduledForDate(
        task.recurrence,
        task.recurrenceConfig,
        date,
        task.createdAt,
        task.dateOverrides
      );
      if (scheduled) return true;

      return allCompletions.some(
        (c) => c.taskId === task.id && c.date === dateStr && c.completed
      );
    })
    .map((task) => mapTaskWithCompletion(task, allCompletions, dateStr));
}

export const AgendaTimeline: React.FC<AgendaTimelineProps> = ({
  selectedDate,
  tasks,
  allTasks = [],
  allCompletions = [],
  onSelectDate,
  onToggleComplete,
  onToggleReminder,
  onEditTask,
  onMoveTaskToTime,
  onDragStartTask,
  onSelectTask,
}) => {
  const [viewMode, setViewMode] = useState<AgendaViewMode>("day");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [dragHoverInfo, setDragHoverInfo] = useState<{ date: string; minute: number } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [resizingState, setResizingState] = useState<{
    taskId: string;
    date: string;
    startMins: number;
    currentHeight: number;
  } | null>(null);

  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const parsedSelectedDate = parseISO(selectedDate);
  const isSelectedDateToday = isSameDay(parsedSelectedDate, new Date());

  // Determine list of displayed days based on viewMode
  const displayedDays = useMemo(() => {
    if (viewMode === "day") {
      return [selectedDate];
    }
    if (viewMode === "3days") {
      return [
        selectedDate,
        format(addDays(parsedSelectedDate, 1), "yyyy-MM-dd"),
        format(addDays(parsedSelectedDate, 2), "yyyy-MM-dd"),
      ];
    }
    // "week": 7 days starting from Monday
    const startMon = startOfWeek(parsedSelectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(startMon, i), "yyyy-MM-dd"));
  }, [viewMode, selectedDate, parsedSelectedDate]);

  // Compute tasks for each displayed day
  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithCompletion[]>();
    for (const d of displayedDays) {
      if (d === selectedDate && tasks.length > 0) {
        map.set(d, tasks.filter((t) => t.effectiveStartTime || t.startTime));
      } else if (allTasks.length > 0) {
        const computed = computeTasksForDate(d, allTasks, allCompletions);
        map.set(d, computed.filter((t) => t.effectiveStartTime || t.startTime));
      } else {
        map.set(d, []);
      }
    }
    return map;
  }, [displayedDays, selectedDate, tasks, allTasks, allCompletions]);

  // Scroll to current hour or 08:00 on initial load
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetHour = isSelectedDateToday ? Math.max(0, Math.floor(currentTimeMinutes / 60) - 1) : 7;
      scrollContainerRef.current.scrollTop = targetHour * HOUR_ROW_HEIGHT;
    }
  }, [selectedDate, isSelectedDateToday, currentTimeMinutes]);

  // Keep live time indicator fresh
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const getSnappedMinuteFromEvent = (e: React.DragEvent, gridEl: HTMLDivElement) => {
    const rect = gridEl.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalMinutes = offsetY; // 1px = 1 min
    const snapped = Math.round(totalMinutes / 5) * 5;
    return Math.max(0, Math.min(23 * 60 + 55, snapped));
  };

  const handleGridDragOver = (e: React.DragEvent, dayDate: string, gridEl: HTMLDivElement) => {
    e.preventDefault();
    const snappedMins = getSnappedMinuteFromEvent(e, gridEl);
    setDragHoverInfo({ date: dayDate, minute: snappedMins });
  };

  const handleGridDragLeave = () => {
    setDragHoverInfo(null);
  };

  const handleGridDrop = (e: React.DragEvent, dayDate: string, gridEl: HTMLDivElement) => {
    e.preventDefault();
    const snappedStartMins = getSnappedMinuteFromEvent(e, gridEl);
    setDragHoverInfo(null);

    const taskId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const dayTasks = tasksByDay.get(dayDate) || [];
    const timedTask = dayTasks.find((t) => t.id === taskId);
    const rawTask = allTasks.find((t) => t.id === taskId);
    const startTimeStr = timedTask?.effectiveStartTime || timedTask?.startTime || rawTask?.startTime;
    const endTimeStr = timedTask?.effectiveEndTime || timedTask?.endTime || rawTask?.endTime;
    let durationMins = 60; // Default 1 hour duration

    if (startTimeStr && endTimeStr) {
      const s = parseTimeToMinutes(startTimeStr);
      const end = parseTimeToMinutes(endTimeStr);
      durationMins = Math.max(15, end - s);
    }

    const snappedEndMins = snappedStartMins + durationMins;

    onMoveTaskToTime(
      taskId,
      formatMinutesToTime(snappedStartMins),
      formatMinutesToTime(snappedEndMins),
      dayDate
    );
  };

  // Interactive Duration Resize Pointer Handler (5-min precision)
  const handleStartResize = (e: React.PointerEvent, task: TaskWithCompletion, dayDate: string) => {
    e.preventDefault();
    const startMins = parseTimeToMinutes(task.effectiveStartTime || task.startTime || "09:00");
    const endMins = parseTimeToMinutes(task.effectiveEndTime || task.endTime || "10:00");
    const initialHeight = Math.max(15, endMins - startMins);

    const startY = e.clientY;
    setResizingState({ taskId: task.id, date: dayDate, startMins, currentHeight: initialHeight });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const rawHeight = initialHeight + deltaY;
      const snappedDuration = Math.max(10, Math.round(rawHeight / 5) * 5);
      setResizingState({ taskId: task.id, date: dayDate, startMins, currentHeight: snappedDuration });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      const deltaY = upEvent.clientY - startY;
      const rawHeight = initialHeight + deltaY;
      const finalDuration = Math.max(10, Math.round(rawHeight / 5) * 5);
      const finalEndMins = startMins + finalDuration;

      onMoveTaskToTime(
        task.id,
        formatMinutesToTime(startMins),
        formatMinutesToTime(finalEndMins),
        dayDate
      );

      setResizingState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const handleBackgroundClick = () => {
    if (resizingState) {
      const finalEndMins = resizingState.startMins + resizingState.currentHeight;
      onMoveTaskToTime(
        resizingState.taskId,
        formatMinutesToTime(resizingState.startMins),
        formatMinutesToTime(finalEndMins),
        resizingState.date
      );
      setResizingState(null);
    }
    setSelectedTaskId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0E0F12] relative overflow-hidden select-none">
      {/* 1. Top Controls Bar: View Mode Switcher (1J | 3J | 7J Semaine) */}
      <div className="flex-shrink-0 px-4 py-2 bg-[#121318] border-b border-[#202228] flex items-center justify-between z-30">
        <div className="flex items-center gap-1 bg-[#1A1C23] p-1 rounded-xl border border-[#2B2D38]">
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              viewMode === "day"
                ? "bg-[#D4F63D] text-black shadow-sm font-bold"
                : "text-[#8E929E] hover:text-white hover:bg-[#252834]"
            )}
          >
            1 Jour
          </button>
          <button
            type="button"
            onClick={() => setViewMode("3days")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              viewMode === "3days"
                ? "bg-[#D4F63D] text-black shadow-sm font-bold"
                : "text-[#8E929E] hover:text-white hover:bg-[#252834]"
            )}
          >
            3 Jours
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              viewMode === "week"
                ? "bg-[#D4F63D] text-black shadow-sm font-bold"
                : "text-[#8E929E] hover:text-white hover:bg-[#252834]"
            )}
          >
            Semaine
          </button>
        </div>

        <span className="text-xs font-mono text-[#8E929E]">
          {viewMode === "day"
            ? format(parsedSelectedDate, "d MMMM yyyy", { locale: fr })
            : `${displayedDays[0]} → ${displayedDays[displayedDays.length - 1]}`}
        </span>
      </div>

      {/* 2. Scrollable Timeline Area */}
      <div
        ref={scrollContainerRef}
        onClick={handleBackgroundClick}
        className="flex-1 overflow-y-auto overflow-x-auto relative bg-[#0E0F12] select-none scroll-smooth pb-28"
      >
        {/* Multi-Day Column Headers (Sticky Top) */}
        {viewMode !== "day" && (
          <div className="sticky top-0 z-30 flex bg-[#13141A] border-b border-[#23252E] shadow-sm">
            {/* Hours column offset */}
            <div className="w-14 md:w-16 flex-shrink-0 border-r border-[#202228] bg-[#111214]" />
            
            {/* Day columns headers */}
            {displayedDays.map((dayStr) => {
              const dayDate = parseISO(dayStr);
              const isDayToday = isSameDay(dayDate, new Date());
              const isCurrentSelected = dayStr === selectedDate;

              return (
                <div
                  key={dayStr}
                  onClick={() => onSelectDate?.(dayStr)}
                  className={cn(
                    "flex-1 min-w-[120px] md:min-w-[150px] py-2 px-2 text-center border-r border-[#202228] transition-colors cursor-pointer",
                    isCurrentSelected
                      ? "bg-[#1C1E28]"
                      : "hover:bg-[#181920]"
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wider block font-semibold text-[#8E929E]">
                    {format(dayDate, "EEE", { locale: fr })}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold font-mono px-2 py-0.5 rounded-full inline-block mt-0.5",
                      isDayToday
                        ? "bg-[#D4F63D] text-black"
                        : isCurrentSelected
                        ? "text-[#D4F63D]"
                        : "text-white"
                    )}
                  >
                    {format(dayDate, "d MMM", { locale: fr })}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 24-Hour Grid Container */}
        <div className="relative min-h-[1440px] flex">
          {/* Left Hours Column (00:00 -> 23:00) */}
          <div className="w-14 md:w-16 flex-shrink-0 border-r border-[#202228] bg-[#111214]/80 z-20 sticky left-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                className="text-right pr-2 text-[10px] md:text-[11px] font-mono font-medium text-[#717684] flex items-start justify-end pt-1"
              >
                <span>{hour.toString().padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {/* Day Grid Columns */}
          {displayedDays.map((dayStr) => {
            const dayDate = parseISO(dayStr);
            const isDayToday = isSameDay(dayDate, new Date());
            const dayTasks = tasksByDay.get(dayStr) || [];

            return (
              <DayGridColumn
                key={dayStr}
                dayDate={dayStr}
                tasks={dayTasks}
                isToday={isDayToday}
                currentTimeMinutes={currentTimeMinutes}
                dragHoverMinute={dragHoverInfo?.date === dayStr ? dragHoverInfo.minute : null}
                selectedTaskId={selectedTaskId}
                resizingState={resizingState?.date === dayStr ? resizingState : null}
                onGridDragOver={handleGridDragOver}
                onGridDragLeave={handleGridDragLeave}
                onGridDrop={handleGridDrop}
                onToggleComplete={onToggleComplete}
                onToggleReminder={onToggleReminder}
                onEditTask={onEditTask}
                onDragStartTask={onDragStartTask}
                onSelectTask={(t) => {
                  setSelectedTaskId(t.id);
                  onSelectTask?.(t);
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

interface DayGridColumnProps {
  dayDate: string;
  tasks: TaskWithCompletion[];
  isToday: boolean;
  currentTimeMinutes: number;
  dragHoverMinute: number | null;
  selectedTaskId: string | null;
  resizingState: { taskId: string; startMins: number; currentHeight: number } | null;
  onGridDragOver: (e: React.DragEvent, dayDate: string, el: HTMLDivElement) => void;
  onGridDragLeave: () => void;
  onGridDrop: (e: React.DragEvent, dayDate: string, el: HTMLDivElement) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
  onDragStartTask: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onSelectTask?: (task: TaskWithCompletion) => void;
  onStartResize: (e: React.PointerEvent, task: TaskWithCompletion, dayDate: string) => void;
}

const DayGridColumn: React.FC<DayGridColumnProps> = ({
  dayDate,
  tasks,
  isToday,
  currentTimeMinutes,
  dragHoverMinute,
  selectedTaskId,
  resizingState,
  onGridDragOver,
  onGridDragLeave,
  onGridDrop,
  onToggleComplete,
  onToggleReminder,
  onEditTask,
  onDragStartTask,
  onSelectTask,
  onStartResize,
}) => {
  const colRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={colRef}
      onDragOver={(e) => colRef.current && onGridDragOver(e, dayDate, colRef.current)}
      onDragLeave={onGridDragLeave}
      onDrop={(e) => colRef.current && onGridDrop(e, dayDate, colRef.current)}
      className="flex-1 min-w-[120px] md:min-w-[150px] relative border-r border-[#1D1F26]"
    >
      {/* Background Hour Lines */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          style={{ height: `${HOUR_ROW_HEIGHT}px` }}
          className="border-b border-[#181A20] relative"
        >
          {/* Half-hour dashed line */}
          <div className="absolute inset-x-0 top-1/2 border-b border-[#16181E]/50 border-dashed" />
        </div>
      ))}

      {/* 5-Min Drag Hover Indicator */}
      {dragHoverMinute !== null && (
        <div
          style={{ top: `${dragHoverMinute}px` }}
          className="absolute inset-x-0 z-40 pointer-events-none flex items-center"
        >
          <div className="bg-[#D4F63D] text-black font-mono font-extrabold text-[9px] md:text-[10px] py-0.5 px-1.5 rounded-full shadow-lg ml-1">
            ⏱ {formatMinutesToTime(dragHoverMinute)}
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
          <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] -ml-1 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <div className="flex-1 border-b-2 border-[#EF4444] shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
        </div>
      )}

      {/* Timed Task Blocks */}
      {(() => {
        interface TimedLayoutItem {
          task: TaskWithCompletion;
          startMins: number;
          layoutEndMins: number;
          height: number;
          column: number;
          totalColumns: number;
        }

        const items: TimedLayoutItem[] = tasks
          .map((task) => {
            const startTimeStr = task.effectiveStartTime !== undefined ? task.effectiveStartTime : task.startTime;
            if (!startTimeStr) return null;

            const startMins = parseTimeToMinutes(startTimeStr);
            const endTimeStr = task.effectiveEndTime !== undefined ? task.effectiveEndTime : task.endTime;
            const isRunningNow = isToday && Boolean(task.isActive);

            const endMins = isRunningNow
              ? Math.max(startMins + 10, currentTimeMinutes)
              : endTimeStr
              ? parseTimeToMinutes(endTimeStr)
              : startMins + 60;

            const defaultDuration = Math.max(
              20,
              isRunningNow ? currentTimeMinutes - startMins : endMins - startMins
            );
            const stableHeight = Math.max(24, defaultDuration);
            const isCurrentlyResizing = resizingState?.taskId === task.id;
            const activeHeight = isCurrentlyResizing ? resizingState.currentHeight : stableHeight;

            const displayTask: TaskWithCompletion = isRunningNow
              ? {
                  ...task,
                  effectiveEndTime: formatMinutesToTime(currentTimeMinutes),
                }
              : task;

            return {
              task: displayTask,
              startMins,
              layoutEndMins: startMins + stableHeight,
              height: activeHeight,
              column: 0,
              totalColumns: 1,
            };
          })
          .filter(Boolean) as TimedLayoutItem[];

        if (items.length === 0) return null;

        // 1. Sort by start time ascending
        items.sort((a, b) => {
          if (a.startMins !== b.startMins) return a.startMins - b.startMins;
          return (b.layoutEndMins - b.startMins) - (a.layoutEndMins - a.startMins);
        });

        // 2. Group into clusters
        const clusters: TimedLayoutItem[][] = [];
        let currentCluster: TimedLayoutItem[] = [];
        let clusterEnd = 0;

        for (const item of items) {
          if (currentCluster.length === 0) {
            currentCluster.push(item);
            clusterEnd = item.layoutEndMins;
          } else if (item.startMins < clusterEnd) {
            currentCluster.push(item);
            clusterEnd = Math.max(clusterEnd, item.layoutEndMins);
          } else {
            clusters.push(currentCluster);
            currentCluster = [item];
            clusterEnd = item.layoutEndMins;
          }
        }
        if (currentCluster.length > 0) {
          clusters.push(currentCluster);
        }

        // 3. Allocate columns
        for (const cluster of clusters) {
          const cols: TimedLayoutItem[][] = [];
          for (const item of cluster) {
            let placed = false;
            for (let c = 0; c < cols.length; c++) {
              const lastInCol = cols[c][cols[c].length - 1];
              if (lastInCol.layoutEndMins <= item.startMins) {
                cols[c].push(item);
                item.column = c;
                placed = true;
                break;
              }
            }
            if (!placed) {
              cols.push([item]);
              item.column = cols.length - 1;
            }
          }
          const totalCols = cols.length;
          for (const item of cluster) {
            item.totalColumns = totalCols;
          }
        }

        // 4. Render blocks
        return items.map((item) => {
          const widthPercent = 100 / (item.totalColumns || 1);
          const leftPercent = (item.column || 0) * widthPercent;

          return (
            <AgendaTaskBlock
              key={item.task.id}
              task={item.task}
              topOffsetPx={item.startMins}
              heightPx={item.height}
              leftPercent={leftPercent}
              widthPercent={widthPercent}
              isSelected={selectedTaskId === item.task.id || resizingState?.taskId === item.task.id}
              onToggleComplete={onToggleComplete}
              onToggleReminder={onToggleReminder}
              onEditTask={onEditTask}
              onDragStart={onDragStartTask}
              onClick={() => onSelectTask?.(item.task)}
              onStartResize={(e, t) => onStartResize(e, t, dayDate)}
            />
          );
        });
      })()}
    </div>
  );
};
