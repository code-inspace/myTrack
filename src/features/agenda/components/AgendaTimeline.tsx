"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Task, TaskWithCompletion, TaskCompletion } from "@/features/tasks/types";
import { AgendaTaskBlock } from "./AgendaTaskBlock";
import { isSameDay, parseISO, addDays, subDays, startOfWeek, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isTaskScheduledForDate, getTodayDateString } from "@/lib/dates";
import { mapTaskWithCompletion } from "@/features/tasks/mappers";
import {
  CheckCircle2,
  Circle,
  Edit3,
  Bell,
  BellOff,
  Sparkles,
  ChevronDown,
  Calendar as CalendarIcon,
  RefreshCw,
  Moon,
} from "lucide-react";
import { DesktopDatePicker } from "@/features/tasks/components/desktop/DesktopDatePicker";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { CalendarSubscriptionsModal } from "@/features/calendar/components/CalendarSubscriptionsModal";
import { ExternalEventBlock } from "@/features/calendar/components/ExternalEventBlock";
import { ExternalEventDetailModal } from "@/features/calendar/components/ExternalEventDetailModal";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { AgendaSleepBlock } from "./AgendaSleepBlock";
import { getStoredSleepLog, computeSleepDuration } from "@/features/sleep/actions";
import { SleepEditModal, SleepSessionData } from "@/features/sleep/components/SleepEditModal";
import { addHoursToTimeString } from "@/lib/dates";
import { useProjects } from "@/features/projects/hooks";

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
  onDeleteTask?: (taskId: string) => void;
  onCreateTaskAtTime?: (date: string, startTime: string, endTime: string) => void;
  onUpdateTask?: (taskId: string, values: any) => void;
  onMoveTaskToTime: (taskId: string, startTime: string, endTime: string, date?: string) => void;
  onDropToAllDay?: (taskId: string, date?: string) => void;
  onMoveTaskOccurrence?: (taskId: string, targetDate: string) => void;
  onDragStartTask: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onSelectTask?: (task: TaskWithCompletion) => void;
  onDuplicateTask?: (task: TaskWithCompletion) => void;
}

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Fitness: { bg: "bg-[#1E3A2B]", text: "text-[#4ADE80]", border: "border-[#22C55E]/30" },
  Sport: { bg: "bg-[#1E3A2B]", text: "text-[#4ADE80]", border: "border-[#22C55E]/30" },
  Santé: { bg: "bg-[#2E1A47]", text: "text-[#C084FC]", border: "border-[#A855F7]/30" },
  Travail: { bg: "bg-[#1E293B]", text: "text-[#60A5FA]", border: "border-[#3B82F6]/30" },
  Apprentissage: { bg: "bg-[#3B2818]", text: "text-[#FB923C]", border: "border-[#F97316]/30" },
  General: { bg: "bg-[#252830]", text: "text-[#E2E8F0]", border: "border-[#475569]/40" },
};

import {
  parseTimeToMinutes,
  formatMinutesToTime,
  formatDurationMinutes,
  calculateResizedDuration,
  calculateResizedEndMinutes,
  calculateTopResizedStartMinutes,
} from "../lib/resize";
import { AgendaTaskDetailModal } from "./AgendaTaskDetailModal";

const HOUR_ROW_HEIGHT = 60; // 60px per hour -> 1px per minute
const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
  onDeleteTask,
  onCreateTaskAtTime,
  onUpdateTask,
  onMoveTaskToTime,
  onDropToAllDay,
  onMoveTaskOccurrence,
  onDragStartTask,
  onSelectTask,
  onDuplicateTask,
}) => {
  const { projects } = useProjects();
  const [viewMode, setViewMode] = useState<AgendaViewMode>("day");
  const [isAllDayExpanded, setIsAllDayExpanded] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState<ExternalCalendarEvent | null>(null);
  const [selectedTaskIdForDetail, setSelectedTaskIdForDetail] = useState<string | null>(null);
  const [selectedTaskForDetailSnapshot, setSelectedTaskForDetailSnapshot] = useState<TaskWithCompletion | null>(null);

  const activeTaskForDetail = useMemo(() => {
    if (!selectedTaskIdForDetail) return null;
    const taskList = allTasks.length > 0 ? allTasks : tasks;
    const foundTask = taskList.find((t) => t.id === selectedTaskIdForDetail) ||
      (selectedTaskForDetailSnapshot?.id === selectedTaskIdForDetail ? selectedTaskForDetailSnapshot : null);
    if (!foundTask) return null;
    return mapTaskWithCompletion(foundTask, allCompletions, selectedDate);
  }, [selectedTaskIdForDetail, allTasks, tasks, allCompletions, selectedDate, selectedTaskForDetailSnapshot]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const justResizedRef = useRef<number>(0);
  const [dragHoverInfo, setDragHoverInfo] = useState<{ date: string; minute: number } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [resizingState, setResizingState] = useState<{
    taskId: string;
    date: string;
    edge: "top" | "bottom";
    initialStartMins: number;
    initialEndMins: number;
    currentStartMins: number;
    currentEndMins: number;
    currentHeight: number;
  } | null>(null);

  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const parsedSelectedDate = parseISO(selectedDate);
  const isSelectedDateToday = isSameDay(parsedSelectedDate, new Date());
  const [sleepSyncVersion, setSleepSyncVersion] = useState(0);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [editingSleepSession, setEditingSleepSession] = useState<SleepSessionData | null>(null);

  useEffect(() => {
    const handleSleepAutoDetected = () => {
      setSleepSyncVersion((v) => v + 1);
    };
    window.addEventListener("mytrack:sleep-auto-detected", handleSleepAutoDetected);
    return () => window.removeEventListener("mytrack:sleep-auto-detected", handleSleepAutoDetected);
  }, []);

  // External Calendar Subscriptions & Events
  const {
    subscriptions,
    events: externalEvents,
    errors: calendarErrors,
    isRefetching: isCalendarRefetching,
    isSyncing: isCalendarSyncing,
    refetch: refetchCalendarEvents,
    syncNow,
    syncSummary,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    toggleSubscription,
  } = useCalendarEvents(selectedDate);

  const enabledSubsCount = (subscriptions || []).filter((s) => s && s.enabled).length;

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

  // Helper to distinguish all-day vs timed tasks
  const isTaskAllDay = (t: TaskWithCompletion) => {
    const time = t.effectiveStartTime !== undefined ? t.effectiveStartTime : t.startTime;
    return !time;
  };

  // Timed tasks for each displayed day
  const timedTasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithCompletion[]>();
    for (const d of displayedDays) {
      if (allTasks && allTasks.length > 0) {
        const computed = computeTasksForDate(d, allTasks, allCompletions || []);
        map.set(d, computed.filter((t) => !isTaskAllDay(t)));
      } else if (d === selectedDate && tasks && tasks.length > 0) {
        map.set(d, tasks.filter((t) => !isTaskAllDay(t)));
      } else {
        map.set(d, []);
      }
    }
    return map;
  }, [displayedDays, selectedDate, tasks, allTasks, allCompletions]);

  // All-day tasks for each displayed day
  const allDayTasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithCompletion[]>();
    for (const d of displayedDays) {
      if (allTasks && allTasks.length > 0) {
        const computed = computeTasksForDate(d, allTasks, allCompletions || []);
        map.set(d, computed.filter(isTaskAllDay));
      } else if (d === selectedDate && tasks && tasks.length > 0) {
        map.set(d, tasks.filter(isTaskAllDay));
      } else {
        map.set(d, []);
      }
    }
    return map;
  }, [displayedDays, selectedDate, tasks, allTasks, allCompletions]);

  // Timed external events by day
  const externalTimedEventsByDay = useMemo(() => {
    const map = new Map<string, ExternalCalendarEvent[]>();
    const safeList = Array.isArray(externalEvents) ? externalEvents : [];
    for (const d of displayedDays) {
      map.set(
        d,
        safeList.filter((e) => e && e.date === d && !e.isAllDay)
      );
    }
    return map;
  }, [displayedDays, externalEvents]);

  // All-day external events by day
  const externalAllDayEventsByDay = useMemo(() => {
    const map = new Map<string, ExternalCalendarEvent[]>();
    const safeList = Array.isArray(externalEvents) ? externalEvents : [];
    for (const d of displayedDays) {
      map.set(
        d,
        safeList.filter((e) => e && e.date === d && e.isAllDay)
      );
    }
    return map;
  }, [displayedDays, externalEvents]);

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

    const dayTasks = timedTasksByDay.get(dayDate) || [];
    const timedTask = dayTasks.find((t) => t.id === taskId);
    const rawTask = allTasks.find((t) => t.id === taskId);
    const startTimeStr = timedTask?.effectiveStartTime || timedTask?.startTime || rawTask?.startTime;
    const endTimeStr = timedTask?.effectiveEndTime || timedTask?.endTime || rawTask?.endTime;
    let durationMins = 60; // Default 1 hour duration

    if (startTimeStr && endTimeStr) {
      const s = parseTimeToMinutes(startTimeStr);
      const end = parseTimeToMinutes(endTimeStr);
      durationMins = Math.max(1, end - s);
    }

    const snappedEndMins = Math.min(23 * 60 + 55, snappedStartMins + durationMins);

    onMoveTaskToTime(
      taskId,
      formatMinutesToTime(snappedStartMins),
      formatMinutesToTime(snappedEndMins),
      dayDate
    );
  };

  // Interactive Duration Resize Pointer Handler (Supports both Top handle for start time and Bottom handle for end time)
  const handleStartResize = (
    e: React.PointerEvent,
    task: TaskWithCompletion,
    edge: "top" | "bottom",
    dayDate: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    justResizedRef.current = Date.now();
    const startMins = parseTimeToMinutes(task.effectiveStartTime || task.startTime || "09:00");
    const endMins = parseTimeToMinutes(task.effectiveEndTime || task.endTime || "10:00");
    const initialStartMins = startMins;
    const initialEndMins = endMins;
    const initialDuration = Math.max(1, endMins - startMins);

    const startY = e.clientY;
    const pointerId = e.pointerId;
    const targetElement = e.currentTarget as HTMLElement;

    try {
      targetElement.setPointerCapture(pointerId);
    } catch {
      // Ignore if pointer capture fails on certain environments
    }

    setResizingState({
      taskId: task.id,
      date: dayDate,
      edge,
      initialStartMins,
      initialEndMins,
      currentStartMins: startMins,
      currentEndMins: endMins,
      currentHeight: initialDuration,
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaY = moveEvent.clientY - startY;

      if (edge === "top") {
        const { startMins: newStart, duration } = calculateTopResizedStartMinutes(
          initialStartMins,
          initialEndMins,
          deltaY,
          5
        );
        setResizingState({
          taskId: task.id,
          date: dayDate,
          edge: "top",
          initialStartMins,
          initialEndMins,
          currentStartMins: newStart,
          currentEndMins: initialEndMins,
          currentHeight: duration,
        });
      } else {
        const { endMins: newEnd, duration } = calculateResizedEndMinutes(
          initialStartMins,
          initialDuration,
          deltaY,
          5
        );
        setResizingState({
          taskId: task.id,
          date: dayDate,
          edge: "bottom",
          initialStartMins,
          initialEndMins,
          currentStartMins: initialStartMins,
          currentEndMins: newEnd,
          currentHeight: duration,
        });
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      justResizedRef.current = Date.now();
      try {
        targetElement.releasePointerCapture(pointerId);
      } catch {}

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      const deltaY = upEvent.clientY - startY;
      let finalStartMins = initialStartMins;
      let finalEndMins = initialEndMins;

      if (edge === "top") {
        const { startMins: newStart } = calculateTopResizedStartMinutes(
          initialStartMins,
          initialEndMins,
          deltaY,
          5
        );
        finalStartMins = newStart;
      } else {
        const { endMins: newEnd } = calculateResizedEndMinutes(
          initialStartMins,
          initialDuration,
          deltaY,
          5
        );
        finalEndMins = newEnd;
      }

      onMoveTaskToTime(
        task.id,
        formatMinutesToTime(finalStartMins),
        formatMinutesToTime(finalEndMins),
        dayDate
      );

      setResizingState(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const handleBackgroundClick = () => {
    if (Date.now() - justResizedRef.current < 400) return;
    if (resizingState) {
      onMoveTaskToTime(
        resizingState.taskId,
        formatMinutesToTime(resizingState.currentStartMins),
        formatMinutesToTime(resizingState.currentEndMins),
        resizingState.date
      );
      setResizingState(null);
    }
    setSelectedTaskId(null);
  };

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 bg-[#0E0F12] relative overflow-hidden select-none">
        {/* 1. Top Controls Bar: Title + View Mode Switcher + Agendas Button + Desktop Date Picker */}
        <div className="flex-shrink-0 px-4 md:px-8 py-3 md:py-4 bg-[#0E0F12] border-b border-[#17181F] flex items-center justify-between z-30 select-none">
          <div className="hidden md:block">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Mon Agenda</h1>
            <p className="text-xs text-[#8E929E] mt-0.5">Planning journalier, 3 jours &amp; hebdomadaire</p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-[#17181F] p-1 rounded-xl border border-[#282B36]">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  viewMode === "day"
                    ? "bg-[#D4F63D] text-black shadow-sm font-bold"
                    : "text-[#8E929E] hover:text-white hover:bg-[#22242C]"
                )}
              >
                1 Jour
              </button>
              <button
                type="button"
                onClick={() => setViewMode("3days")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  viewMode === "3days"
                    ? "bg-[#D4F63D] text-black shadow-sm font-bold"
                    : "text-[#8E929E] hover:text-white hover:bg-[#22242C]"
                )}
              >
                3 Jours
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  viewMode === "week"
                    ? "bg-[#D4F63D] text-black shadow-sm font-bold"
                    : "text-[#8E929E] hover:text-white hover:bg-[#22242C]"
                )}
              >
                Semaine
              </button>
            </div>

            {/* iCal / Google Calendars Configuration Button */}
            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                enabledSubsCount > 0
                  ? "bg-[#1E293B] border-[#3B82F6]/40 text-[#60A5FA] hover:border-[#3B82F6]"
                  : "bg-[#17181F] border-[#282B36] text-[#8E929E] hover:text-white hover:bg-[#22242C]"
              )}
              title="Gérer les flux iCal / Google Calendar"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agendas</span>
              {enabledSubsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#3B82F6]/20 text-[#60A5FA]">
                  {enabledSubsCount}
                </span>
              )}
              {(isCalendarSyncing || isCalendarRefetching) && (
                <RefreshCw className="w-3 h-3 animate-spin text-[#D4F63D] ml-0.5" />
              )}
            </button>

            {/* Desktop only: interactive date picker */}
            <div className="hidden md:block">
              <DesktopDatePicker
                selectedDate={selectedDate}
                onSelectDate={(d) => onSelectDate?.(d)}
              />
            </div>
          </div>
        </div>

        {/* 2. Scrollable Timeline Area (Unified horizontal + vertical scroll container) */}
        <div
          ref={scrollContainerRef}
          onClick={handleBackgroundClick}
          className="flex-1 overflow-y-auto overflow-x-auto relative bg-[#0E0F12] select-none scroll-smooth pb-28"
        >
          {/* Sticky Top Block: Multi-Day Headers + Jour Entier Row */}
          <div className="sticky top-0 z-30 flex flex-col bg-[#141518] border-b border-[#23252E] shadow-md">
            {/* Row 1: Day Column Dates (in 3-days and week modes) */}
            {viewMode !== "day" && (
              <div className="flex border-b border-[#202228] bg-[#13141A]">
                {/* Hours column offset (Sticky Left) */}
                <div className="w-14 md:w-16 flex-shrink-0 border-r border-[#202228] bg-[#111214] sticky left-0 z-40" />

                {/* Day columns headers */}
                {displayedDays.map((dayStr) => {
                  const dayDate = parseISO(dayStr);
                  const isDayToday = isSameDay(dayDate, new Date());
                  const isCurrentSelected = dayStr === selectedDate;

                  return (
                    <div
                      key={dayStr}
                      onClick={() => onSelectDate?.(dayStr)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const taskId =
                          e.dataTransfer.getData("taskId") ||
                          e.dataTransfer.getData("text/plain");
                        if (taskId) {
                          if (onMoveTaskOccurrence) {
                            onMoveTaskOccurrence(taskId, dayStr);
                          } else if (onDropToAllDay) {
                            onDropToAllDay(taskId, dayStr);
                          }
                        }
                      }}
                      className={cn(
                        "flex-1 min-w-[120px] md:min-w-[150px] py-1.5 px-2 text-center border-r border-[#202228] transition-colors cursor-pointer",
                        isCurrentSelected ? "bg-[#1C1E28]" : "hover:bg-[#181920]"
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

            {/* Row 2: Multi-Day "Jour entier" Section */}
            <div className="flex bg-[#141518]">
              {/* Left "Jour entier" Label Column */}
              <button
                type="button"
                onClick={() => setIsAllDayExpanded(!isAllDayExpanded)}
                className="w-14 md:w-16 flex-shrink-0 border-r border-[#202228] p-1 flex flex-col justify-center items-center text-center bg-[#111214] hover:bg-[#1C1D24] sticky left-0 z-35 transition-colors cursor-pointer group"
              >
                <span className="text-[9px] md:text-[10px] font-bold text-[#8E929E] group-hover:text-white uppercase tracking-tighter leading-tight">
                  Jour<br />entier
                </span>
                <ChevronDown
                  className={cn(
                    "w-3 h-3 text-[#D4F63D] mt-0.5 transition-transform duration-200",
                    isAllDayExpanded ? "rotate-180" : ""
                  )}
                />
              </button>

              {/* Day All-Day Columns */}
              {displayedDays.map((dayStr) => {
                const dayAllDayTasks = allDayTasksByDay.get(dayStr) || [];
                const dayAllDayExternal = externalAllDayEventsByDay.get(dayStr) || [];
                const isCurrentSelected = dayStr === selectedDate;

                const hasAnyAllDay = dayAllDayTasks.length > 0 || dayAllDayExternal.length > 0;

                return (
                  <div
                    key={`allday-${dayStr}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData("taskId") || e.dataTransfer.getData("text/plain");
                      if (taskId && onDropToAllDay) {
                        onDropToAllDay(taskId, dayStr);
                      }
                    }}
                    className={cn(
                      "flex-1 p-1.5 flex flex-wrap items-center gap-1.5 border-r border-[#202228] transition-all duration-300",
                      viewMode !== "day" ? "min-w-[120px] md:min-w-[150px]" : "min-w-0",
                      isAllDayExpanded
                        ? "min-h-[46px] max-h-none overflow-visible"
                        : "min-h-[46px] max-h-[50px] overflow-hidden",
                      isCurrentSelected ? "bg-[#161820]" : "bg-[#141518]"
                    )}
                  >
                    {!hasAnyAllDay ? (
                      <div className="text-[10px] text-[#555866] italic px-1 flex items-center gap-1">
                        {viewMode === "day" ? (
                          <>
                            <Sparkles className="w-3 h-3 text-[#D4F63D]" />
                            <span>Glisse une tâche ici pour la journée entière</span>
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* 1. External All-Day Events */}
                        {dayAllDayExternal.map((extEvent) => {
                          const calColor = extEvent.calendarColor || "#3B82F6";
                          const project = extEvent.projectId ? projects.find((p) => p.id === extEvent.projectId) : null;
                          return (
                            <button
                              key={extEvent.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedExternalEvent(extEvent);
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold shadow-sm transition-all duration-150 hover:scale-[1.02] cursor-pointer"
                              style={{
                                backgroundColor: `${calColor}20`,
                                borderColor: `${calColor}50`,
                                color: "#FFFFFF",
                              }}
                              title={`${extEvent.title} (${extEvent.calendarName}${project ? ` • Projet: ${project.name}` : ""})`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: calColor }}
                              />
                              {project && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-black/40 text-white font-medium text-[9px] border border-white/10 flex-shrink-0">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: project.color || "#D4F63D" }}
                                  />
                                  <span className="truncate max-w-[60px]">{project.name}</span>
                                </span>
                              )}
                              <span className="truncate max-w-[90px] md:max-w-[120px]">
                                {extEvent.title}
                              </span>
                            </button>
                          );
                        })}

                        {/* 2. MyTrack All-Day Tasks */}
                        {dayAllDayTasks.map((task) => {
                          const tagKey = task.tag || task.category || "General";
                          const style = TAG_COLORS[tagKey] || TAG_COLORS.General;
                          const isRemindersEnabled = task.enableReminders !== false;
                          const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;

                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", task.id);
                                e.dataTransfer.setData("taskId", task.id);
                                onDragStartTask(e, task);
                              }}
                              onClick={() => {
                                setSelectedTaskId(task.id);
                                setSelectedTaskIdForDetail(task.id);
                                setSelectedTaskForDetailSnapshot(task);
                                onSelectTask?.(task);
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing hover:scale-[1.02]",
                                style.bg,
                                style.text,
                                style.border,
                                task.isCompletedToday ? "opacity-60 line-through" : ""
                              )}
                              title={task.title}
                            >
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleComplete(task.id);
                                }}
                                className="hover:scale-110 transition-transform cursor-pointer"
                              >
                                {task.isCompletedToday ? (
                                  <CheckCircle2 className="w-3 h-3 text-[#D4F63D] fill-[#D4F63D]/20" />
                                ) : (
                                  <Circle className="w-3 h-3 opacity-60" />
                                )}
                              </button>
                              {project && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-black/40 text-white font-medium text-[9px] border border-white/10 flex-shrink-0">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: project.color || "#D4F63D" }}
                                  />
                                  <span className="truncate max-w-[60px]">{project.name}</span>
                                </span>
                              )}
                              <span className="truncate max-w-[90px] md:max-w-[120px]">{task.title}</span>

                              {onToggleReminder && (
                                <button
                                  type="button"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleReminder(task.id);
                                  }}
                                  className="hover:scale-115 transition-transform cursor-pointer opacity-70 hover:opacity-100 p-0.5"
                                >
                                  {isRemindersEnabled ? (
                                    <Bell className="w-2.5 h-2.5 text-[#D4F63D]" />
                                  ) : (
                                    <BellOff className="w-2.5 h-2.5 opacity-50" />
                                  )}
                                </button>
                              )}

                              {onEditTask && (
                                <button
                                  type="button"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditTask(task);
                                  }}
                                  className="hover:scale-115 transition-transform cursor-pointer opacity-70 hover:opacity-100 p-0.5"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 24-Hour Grid Container */}
          <div className="relative min-h-[1440px] flex">
            {/* Left Hours Column (00:00 -> 23:00) */}
            <div className="w-14 md:w-16 flex-shrink-0 border-r border-[#202228] bg-[#111214]/90 z-20 sticky left-0">
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
              const dayTasks = timedTasksByDay.get(dayStr) || [];
              const dayExternalEvents = externalTimedEventsByDay.get(dayStr) || [];

              return (
                <DayGridColumn
                  key={dayStr}
                  dayDate={dayStr}
                  tasks={dayTasks}
                  externalEvents={dayExternalEvents}
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
                  onCreateTaskAtTime={onCreateTaskAtTime}
                  onDragStartTask={onDragStartTask}
                  onSelectTask={(t) => {
                    if (Date.now() - justResizedRef.current < 400) return;
                    setSelectedTaskIdForDetail(t.id);
                    setSelectedTaskForDetailSnapshot(t);
                    onSelectTask?.(t);
                  }}
                  onSelectForResize={(t) => {
                    setSelectedTaskId(t.id);
                  }}
                  onSelectExternalEvent={(ext) => setSelectedExternalEvent(ext)}
                  onSelectSleepSession={(session) => {
                    setEditingSleepSession(session);
                    setIsSleepModalOpen(true);
                  }}
                  onStartResize={handleStartResize}
                  sleepSyncVersion={sleepSyncVersion}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendar Subscriptions Configuration Modal */}
      <CalendarSubscriptionsModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        subscriptions={subscriptions}
        onAddSubscription={addSubscription}
        onUpdateSubscription={updateSubscription}
        onDeleteSubscription={deleteSubscription}
        onToggleSubscription={toggleSubscription}
        onRefresh={() => refetchCalendarEvents()}
        onSyncNow={syncNow}
        syncSummary={syncSummary}
        isRefetching={isCalendarRefetching}
        errors={calendarErrors}
      />

      {/* External Event Details Modal */}
      <ExternalEventDetailModal
        event={selectedExternalEvent}
        onClose={() => setSelectedExternalEvent(null)}
      />

      {/* Task Details & Edit Modal (Apple Calendar style) */}
      <AgendaTaskDetailModal
        task={activeTaskForDetail}
        isOpen={Boolean(selectedTaskIdForDetail && activeTaskForDetail)}
        selectedDate={selectedDate}
        onClose={() => {
          setSelectedTaskIdForDetail(null);
          setSelectedTaskForDetailSnapshot(null);
        }}
        onToggleComplete={onToggleComplete}
        onToggleReminder={onToggleReminder}
        onDuplicateTask={onDuplicateTask}
        onDeleteTask={(taskId) => {
          setSelectedTaskIdForDetail(null);
          setSelectedTaskForDetailSnapshot(null);
          onDeleteTask?.(taskId);
        }}
        onEditTask={(t) => {
          setSelectedTaskIdForDetail(null);
          setSelectedTaskForDetailSnapshot(null);
          onEditTask?.(t);
        }}
        onUpdateTask={onUpdateTask}
        onUpdateTimes={(taskId, start, end, date) => {
          onMoveTaskToTime(taskId, start, end, date);
        }}
      />

      {/* Sleep Session Edit Modal (Dodo & Siestes) */}
      <SleepEditModal
        isOpen={isSleepModalOpen}
        initialSession={editingSleepSession}
        onClose={() => {
          setIsSleepModalOpen(false);
          setEditingSleepSession(null);
        }}
        onSaved={() => {
          setSleepSyncVersion((v) => v + 1);
        }}
      />
    </>
  );
};

interface DayGridColumnProps {
  dayDate: string;
  tasks: TaskWithCompletion[];
  externalEvents?: ExternalCalendarEvent[];
  isToday: boolean;
  currentTimeMinutes: number;
  dragHoverMinute: number | null;
  selectedTaskId: string | null;
  resizingState: {
    taskId: string;
    date: string;
    edge: "top" | "bottom";
    currentStartMins: number;
    currentEndMins: number;
    currentHeight: number;
  } | null;
  onGridDragOver: (e: React.DragEvent, dayDate: string, el: HTMLDivElement) => void;
  onGridDragLeave: () => void;
  onGridDrop: (e: React.DragEvent, dayDate: string, el: HTMLDivElement) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleReminder?: (taskId: string) => void;
  onEditTask?: (task: TaskWithCompletion) => void;
  onCreateTaskAtTime?: (date: string, startTime: string, endTime: string) => void;
  onDragStartTask: (e: React.DragEvent, task: TaskWithCompletion) => void;
  onSelectTask?: (task: TaskWithCompletion) => void;
  onSelectForResize?: (task: TaskWithCompletion) => void;
  onSelectExternalEvent?: (event: ExternalCalendarEvent) => void;
  onSelectSleepSession?: (session: SleepSessionData) => void;
  onStartResize: (e: React.PointerEvent, task: TaskWithCompletion, edge: "top" | "bottom", dayDate: string) => void;
  sleepSyncVersion?: number;
}

const DayGridColumn: React.FC<DayGridColumnProps> = ({
  dayDate,
  tasks,
  externalEvents = [],
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
  onCreateTaskAtTime,
  onDragStartTask,
  onSelectTask,
  onSelectForResize,
  onSelectExternalEvent,
  onSelectSleepSession,
  onStartResize,
  sleepSyncVersion,
}) => {
  const colRef = useRef<HTMLDivElement>(null);
  const longPressEmptyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownCoordRef = useRef<{ x: number; y: number } | null>(null);

  const handleEmptyPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-agenda-block]") ||
      target.closest("[data-task-id]") ||
      target.closest("[data-event-id]") ||
      target.closest("[data-sleep-block]") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a")
    ) {
      return;
    }

    pointerDownCoordRef.current = { x: e.clientX, y: e.clientY };
    if (longPressEmptyTimerRef.current) clearTimeout(longPressEmptyTimerRef.current);

    longPressEmptyTimerRef.current = setTimeout(() => {
      if (!colRef.current) return;
      const rect = colRef.current.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const snappedStartMins = Math.max(0, Math.min(23 * 60, Math.round(offsetY / 5) * 5));
      const snappedEndMins = Math.min(23 * 60 + 55, snappedStartMins + 60);

      try {
        navigator.vibrate?.(35);
      } catch {}

      onCreateTaskAtTime?.(
        dayDate,
        formatMinutesToTime(snappedStartMins),
        formatMinutesToTime(snappedEndMins)
      );
    }, 350);
  };

  const handleEmptyPointerMove = (e: React.PointerEvent) => {
    if (!pointerDownCoordRef.current) return;
    const dx = Math.abs(e.clientX - pointerDownCoordRef.current.x);
    const dy = Math.abs(e.clientY - pointerDownCoordRef.current.y);
    if (dx > 8 || dy > 8) {
      if (longPressEmptyTimerRef.current) {
        clearTimeout(longPressEmptyTimerRef.current);
        longPressEmptyTimerRef.current = null;
      }
      pointerDownCoordRef.current = null;
    }
  };

  const handleEmptyPointerUpOrCancel = () => {
    if (longPressEmptyTimerRef.current) {
      clearTimeout(longPressEmptyTimerRef.current);
      longPressEmptyTimerRef.current = null;
    }
    pointerDownCoordRef.current = null;
  };

  return (
    <div
      ref={colRef}
      onPointerDown={handleEmptyPointerDown}
      onPointerMove={handleEmptyPointerMove}
      onPointerUp={handleEmptyPointerUpOrCancel}
      onPointerCancel={handleEmptyPointerUpOrCancel}
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

      {/* Timed Task Blocks, External Events & Dodo Sleep Blocks Unified Clustering */}
      {(() => {
        interface TimedLayoutItem {
          type: "task" | "external" | "sleep";
          task?: TaskWithCompletion;
          externalEvent?: ExternalCalendarEvent;
          sleepItem?: {
            id: string;
            label: string;
            subLabel?: string;
            isNap?: boolean;
            sessionData: SleepSessionData;
          };
          id: string;
          startMins: number;
          layoutEndMins: number;
          height: number;
          column: number;
          totalColumns: number;
        }

        // 1. Map MyTrack tasks - Exact real proportional height matching Apple Calendar
        const taskItems: TimedLayoutItem[] = tasks
          .map((task) => {
            const startTimeStr = task.effectiveStartTime !== undefined ? task.effectiveStartTime : task.startTime;
            if (!startTimeStr) return null;

            const isCurrentlyResizing = resizingState?.taskId === task.id;
            const startMins = isCurrentlyResizing
              ? resizingState.currentStartMins
              : parseTimeToMinutes(startTimeStr);

            const endTimeStr = task.effectiveEndTime !== undefined ? task.effectiveEndTime : task.endTime;
            const isRunningNow = isToday && Boolean(task.isActive);

            const endMins = isCurrentlyResizing
              ? resizingState.currentEndMins
              : isRunningNow
              ? Math.max(startMins + 5, currentTimeMinutes)
              : endTimeStr
              ? parseTimeToMinutes(endTimeStr)
              : startMins + 60;

            const duration = Math.max(1, endMins - startMins);
            const activeHeight = isCurrentlyResizing ? resizingState.currentHeight : duration;

            const displayTask: TaskWithCompletion = isRunningNow
              ? {
                  ...task,
                  effectiveEndTime: formatMinutesToTime(currentTimeMinutes),
                }
              : task;

            return {
              type: "task" as const,
              task: displayTask,
              id: `task-${task.id}`,
              startMins,
              layoutEndMins: startMins + activeHeight,
              height: activeHeight,
              column: 0,
              totalColumns: 1,
            };
          })
          .filter(Boolean) as TimedLayoutItem[];

        // 2. Map External Events
        const externalItems: TimedLayoutItem[] = externalEvents
          .map((ext) => {
            if (!ext.startTime) return null;
            const startMins = parseTimeToMinutes(ext.startTime);
            const endMins = ext.endTime ? parseTimeToMinutes(ext.endTime) : startMins + 60;
            const duration = Math.max(1, endMins - startMins);

            return {
              type: "external" as const,
              externalEvent: ext,
              id: `ext-${ext.id}`,
              startMins,
              layoutEndMins: startMins + duration,
              height: duration,
              column: 0,
              totalColumns: 1,
            };
          })
          .filter(Boolean) as TimedLayoutItem[];

        // 3. Map Auto-detected Dodo Sleep & Nap Blocks
        const sleepItems: TimedLayoutItem[] = [];
        try {
          const d = parseISO(dayDate);
          const yesterdayDateStr = format(subDays(d, 1), "yyyy-MM-dd");
          const yesterdayLog = getStoredSleepLog(yesterdayDateStr);
          const todayLog = getStoredSleepLog(dayDate);
          const tomorrowDateStr = format(addDays(d, 1), "yyyy-MM-dd");
          const tomorrowLog = getStoredSleepLog(tomorrowDateStr);

          // 3a. Morning Sleep (night leading into dayDate)
          if (todayLog.wakeTime) {
            const wakeMins = parseTimeToMinutes(todayLog.wakeTime);
            if (wakeMins > 0) {
              const yesterdayBedtime = yesterdayLog.bedtime || "23:00";
              let startMins = 0;
              let durationText = "";

              const dur = computeSleepDuration(yesterdayBedtime, todayLog.wakeTime);
              if (dur) durationText = dur.text;

              const bedMins = parseTimeToMinutes(yesterdayBedtime);
              if (bedMins < 12 * 60 && bedMins < wakeMins) {
                startMins = bedMins;
              }

              const duration = Math.max(15, wakeMins - startMins);
              const subLabel = durationText
                ? `${durationText} • Réveil ${todayLog.wakeTime}`
                : `Réveil ${todayLog.wakeTime}`;

              sleepItems.push({
                type: "sleep",
                sleepItem: {
                  id: `sleep-morning-${dayDate}`,
                  label: "Dodo",
                  subLabel,
                  isNap: false,
                  sessionData: {
                    sessionType: "night",
                    startDate: yesterdayDateStr,
                    startTime: yesterdayBedtime,
                    endDate: dayDate,
                    endTime: todayLog.wakeTime,
                  },
                },
                id: `sleep-morning-${dayDate}`,
                startMins,
                layoutEndMins: startMins + duration,
                height: duration,
                column: 0,
                totalColumns: 1,
              });
            }
          }

          // 3b. Evening Bedtime Onset
          if (todayLog.bedtime) {
            const bedMins = parseTimeToMinutes(todayLog.bedtime);
            if (bedMins >= 18 * 60 && bedMins < 1440) {
              const duration = 1440 - bedMins;
              const tomorrowWakeTime = tomorrowLog.wakeTime || "07:00";
              const dur = computeSleepDuration(todayLog.bedtime, tomorrowWakeTime);
              const subLabel = dur?.text
                ? `${dur.text} • Coucher ${todayLog.bedtime}`
                : `Coucher ${todayLog.bedtime}`;

              sleepItems.push({
                type: "sleep",
                sleepItem: {
                  id: `sleep-evening-${dayDate}`,
                  label: "Dodo",
                  subLabel,
                  isNap: false,
                  sessionData: {
                    sessionType: "night",
                    startDate: dayDate,
                    startTime: todayLog.bedtime,
                    endDate: tomorrowDateStr,
                    endTime: tomorrowWakeTime,
                  },
                },
                id: `sleep-evening-${dayDate}`,
                startMins: bedMins,
                layoutEndMins: 1440,
                height: Math.max(15, duration),
                column: 0,
                totalColumns: 1,
              });
            }
          }

          // 3c. Daytime Naps
          if (todayLog.naps && todayLog.naps.length > 0) {
            todayLog.naps.forEach((nap, idx) => {
              if (nap.startTime) {
                // If this nap is already represented by an existing task on today's timeline, avoid duplicate block
                const hasMatchingTask = tasks.some(
                  (t) => t.id === nap.taskId || nap.id === `task-nap-${t.id}`
                );
                if (hasMatchingTask) return;

                const startMins = parseTimeToMinutes(nap.startTime);
                const endMins = nap.endTime ? parseTimeToMinutes(nap.endTime) : startMins + 45;
                const duration = Math.max(15, endMins - startMins);
                sleepItems.push({
                  type: "sleep",
                  sleepItem: {
                    id: `sleep-nap-${dayDate}-${nap.id || idx}`,
                    label: nap.title || "Sieste",
                    subLabel: `${nap.startTime} - ${nap.endTime || "..."}`,
                    isNap: true,
                    sessionData: {
                      sessionType: "nap",
                      startDate: dayDate,
                      startTime: nap.startTime,
                      endDate: dayDate,
                      endTime: nap.endTime || addHoursToTimeString(nap.startTime, 1),
                      napId: nap.id,
                    },
                  },
                  id: `sleep-nap-${dayDate}-${nap.id || idx}`,
                  startMins,
                  layoutEndMins: startMins + duration,
                  height: duration,
                  column: 0,
                  totalColumns: 1,
                });
              }
            });
          }
        } catch (e) {
          console.warn("Error calculating sleep items for timeline:", e);
        }

        // 4. Combine all items
        const allItems = [...taskItems, ...externalItems, ...sleepItems];
        if (allItems.length === 0) return null;

        // 5. Build overlap clusters
        const sorted = [...allItems].sort((a, b) => a.startMins - b.startMins);
        const clusters: TimedLayoutItem[][] = [];
        let curCluster: TimedLayoutItem[] = [];
        let curClusterEnd = -1;

        for (const item of sorted) {
          if (curCluster.length === 0) {
            curCluster.push(item);
            curClusterEnd = item.layoutEndMins;
          } else if (item.startMins < curClusterEnd) {
            curCluster.push(item);
            curClusterEnd = Math.max(curClusterEnd, item.layoutEndMins);
          } else {
            clusters.push(curCluster);
            curCluster = [item];
            curClusterEnd = item.layoutEndMins;
          }
        }
        if (curCluster.length > 0) {
          clusters.push(curCluster);
        }

        // 6. Assign columns within each cluster (Greedy interval coloring)
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

        // 7. Render blocks
        return allItems.map((item) => {
          const widthPercent = 100 / (item.totalColumns || 1);
          const leftPercent = (item.column || 0) * widthPercent;

          if (item.type === "sleep" && item.sleepItem) {
            return (
              <AgendaSleepBlock
                key={item.id}
                label={item.sleepItem.label}
                subLabel={item.sleepItem.subLabel}
                topOffsetPx={item.startMins}
                heightPx={item.height}
                leftPercent={leftPercent}
                widthPercent={widthPercent}
                isNap={item.sleepItem.isNap}
                onClick={() => onSelectSleepSession?.(item.sleepItem!.sessionData)}
              />
            );
          }

          if (item.type === "external" && item.externalEvent) {
            return (
              <ExternalEventBlock
                key={item.id}
                event={item.externalEvent}
                topOffsetPx={item.startMins}
                heightPx={item.height}
                leftPercent={leftPercent}
                widthPercent={widthPercent}
                onClick={() => onSelectExternalEvent?.(item.externalEvent!)}
              />
            );
          }

          if (item.type === "task" && item.task) {
            const isCurrentlyResizing = resizingState?.taskId === item.task.id && resizingState?.date === dayDate;
            const resizingInfo = isCurrentlyResizing
              ? {
                  edge: resizingState.edge,
                  currentTime: formatMinutesToTime(
                    resizingState.edge === "top"
                      ? resizingState.currentStartMins
                      : resizingState.currentEndMins
                  ),
                  fullRange: `${formatMinutesToTime(resizingState.currentStartMins)} - ${formatMinutesToTime(resizingState.currentEndMins)}`,
                  durationStr: formatDurationMinutes(resizingState.currentHeight),
                }
              : null;

            return (
              <AgendaTaskBlock
                key={item.id}
                task={item.task}
                topOffsetPx={item.startMins}
                heightPx={item.height}
                leftPercent={leftPercent}
                widthPercent={widthPercent}
                isSelected={selectedTaskId === item.task.id || isCurrentlyResizing}
                resizingInfo={resizingInfo}
                onDragStart={onDragStartTask}
                onClick={() => {
                  onSelectTask?.(item.task!);
                }}
                onSelectForResize={(t) => {
                  onSelectForResize?.(t);
                }}
                onStartResize={(e, t, edge) => onStartResize(e, t, edge, dayDate)}
              />
            );
          }

          return null;
        });
      })()}

      {/* Horizontal timeline guideline during live resize */}
      {resizingState && resizingState.date === dayDate && (
        <div
          className="absolute left-0 right-0 z-40 pointer-events-none flex items-center transition-all duration-75"
          style={{
            top: `${resizingState.edge === "top" ? resizingState.currentStartMins : resizingState.currentEndMins}px`,
          }}
        >
          <div className="h-[2px] w-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
        </div>
      )}
    </div>
  );
};
