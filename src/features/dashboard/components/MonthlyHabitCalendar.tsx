"use client";

import React, { useState } from "react";
import { TaskRecord, CompletionRecord, isHabitScheduledOn } from "@/features/analytics/calculations";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Check, X, Flame, Calendar, Trophy, Sparkles, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthlyHabitCalendarProps {
  tasks: TaskRecord[];
  completions: CompletionRecord[];
  monthDate: Date;
}

const FRENCH_DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

export const MonthlyHabitCalendar: React.FC<MonthlyHabitCalendarProps> = ({
  tasks = [],
  completions = [],
  monthDate,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>("ALL");

  const safeTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const safeCompletions = Array.isArray(completions) ? completions.filter(Boolean) : [];
  const safeMonthDate =
    monthDate instanceof Date && !isNaN(monthDate.getTime()) ? monthDate : new Date();

  const monthStart = startOfMonth(safeMonthDate);
  const monthEnd = endOfMonth(safeMonthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  let calendarDays: Date[] = [];
  try {
    calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  } catch {
    calendarDays = [];
  }

  let monthName = "";
  try {
    monthName = format(safeMonthDate, "MMMM yyyy", { locale: fr });
  } catch {
    monthName = "Mois";
  }

  const selectedTask = safeTasks.find((t) => t.id === selectedTaskId);

  // Calculate monthly stats for the selected habit (or all habits)
  let daysInCurrentMonth: Date[] = [];
  try {
    daysInCurrentMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  } catch {
    daysInCurrentMonth = [];
  }
  let scheduledDaysCount = 0;
  let completedDaysCount = 0;

  daysInCurrentMonth.forEach((d) => {
    const dateStr = format(d, "yyyy-MM-dd");
    if (selectedTaskId === "ALL") {
      const scheduledTasks = safeTasks.filter((t) => isHabitScheduledOn(t, d));
      // Only completions of habits scheduled that day count (same rule as the dashboard stats)
      const dayCompletions = safeCompletions.filter(
        (c) => c.date === dateStr && c.completed && scheduledTasks.some((t) => t.id === c.taskId)
      );
      if (scheduledTasks.length > 0) {
        scheduledDaysCount++;
        if (dayCompletions.length >= scheduledTasks.length) {
          completedDaysCount++;
        }
      }
    } else if (selectedTask) {
      const isSched = isHabitScheduledOn(selectedTask, d);
      const isDone = completions.some(
        (c) => c.taskId === selectedTaskId && c.date === dateStr && c.completed
      );
      if (isSched) {
        scheduledDaysCount++;
        if (isDone) completedDaysCount++;
      }
    }
  });

  const monthRate =
    scheduledDaysCount > 0
      ? Math.round((completedDaysCount / scheduledDaysCount) * 100)
      : 0;

  return (
    <div className="w-full bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
      {/* 1. Header & Habit Selector Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#282A30]">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4F63D]" />
            <span>Calendrier Mensuel</span>
          </h3>
          <p className="text-[11px] text-[#8E929E] capitalize">{monthName}</p>
        </div>

        {/* Habit Dropdown Selector */}
        <div className="relative">
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full sm:w-auto bg-[#141518] text-white text-xs font-bold py-2 px-3 pr-8 rounded-xl border border-[#2F333E] outline-none focus:border-[#D4F63D] cursor-pointer appearance-none shadow-sm"
          >
            <option value="ALL">📊 Toutes les habitudes</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {(task.tag === "Sport" || task.tag === "Fitness" || task.category === "Sport" || task.category === "Fitness")
                  ? "🏋️"
                  : (task.tag === "Santé" || task.tag === "Health" || task.category === "Santé" || task.category === "Health")
                  ? "🧘"
                  : (task.tag === "Apprentissage" || task.tag === "Learning" || task.category === "Apprentissage" || task.category === "Learning")
                  ? "📚"
                  : "🎯"}{" "}
                {task.title}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E929E]">
            ▾
          </div>
        </div>
      </div>

      {/* 2. Monthly Summary KPI Badges */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-[#141518] p-3 rounded-2xl border border-[#262932] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-[#8E929E] uppercase">
              Taux de complétion
            </span>
            <div className="text-xl font-extrabold text-white mt-0.5">{monthRate}%</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#D4F63D]/10 text-[#D4F63D] flex items-center justify-center font-bold text-xs">
            <Trophy className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#141518] p-3 rounded-2xl border border-[#262932] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-[#8E929E] uppercase">
              Jours réussis
            </span>
            <div className="text-xl font-extrabold text-[#D4F63D] mt-0.5">
              {completedDaysCount} <span className="text-xs text-[#8E929E]">/ {scheduledDaysCount}</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center font-bold text-xs">
            <Flame className="w-4 h-4 fill-current" />
          </div>
        </div>
      </div>

      {/* 3. 7-Column Calendar Grid */}
      <div className="pt-1">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {FRENCH_DAYS_SHORT.map((day, i) => (
            <span key={i} className="text-[11px] font-bold text-[#8E929E]">
              {day}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((d, index) => {
            const dateStr = format(d, "yyyy-MM-dd");
            const inCurrentMonth = isSameMonth(d, monthDate);
            const isCurrentDay = isToday(d);

            let isDone = false;
            let isScheduled = false;
            let dayRate = 0;

            if (selectedTaskId === "ALL") {
              const scheduled = tasks.filter((t) => isHabitScheduledOn(t, d));
              const dayCompletions = completions.filter(
                (c) => c.date === dateStr && c.completed && scheduled.some((t) => t.id === c.taskId)
              );
              isScheduled = scheduled.length > 0;
              isDone = isScheduled && dayCompletions.length >= scheduled.length;
              dayRate = scheduled.length > 0 ? Math.round((dayCompletions.length / scheduled.length) * 100) : 0;
            } else if (selectedTask) {
              isScheduled = isHabitScheduledOn(selectedTask, d);
              isDone = completions.some(
                (c) => c.taskId === selectedTaskId && c.date === dateStr && c.completed
              );
            }

            if (!inCurrentMonth) {
              return (
                <div
                  key={index}
                  className="aspect-square rounded-xl bg-[#141518]/30 flex items-center justify-center text-[10px] text-[#4B5563] font-medium opacity-30 pointer-events-none"
                >
                  {format(d, "d")}
                </div>
              );
            }

            return (
              <div
                key={index}
                className={cn(
                  "aspect-square rounded-xl p-1 flex flex-col items-center justify-between transition-all relative",
                  isDone
                    ? "bg-[#D4F63D] text-black shadow-md font-extrabold"
                    : isScheduled
                    ? "bg-[#252830] text-white border border-[#343740]"
                    : "bg-[#141518] text-[#8E929E] border border-[#202228]",
                  isCurrentDay ? "ring-2 ring-white" : ""
                )}
                title={`${format(d, "d MMMM", { locale: fr })}: ${
                  isDone ? "✓ Fait" : isScheduled ? "✗ Non fait" : "Non planifié"
                }`}
              >
                <span className="text-[10px] font-mono leading-none">
                  {format(d, "d")}
                </span>

                <div className="flex items-center justify-center">
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 stroke-[3.5] text-black" />
                  ) : isScheduled ? (
                    <X className="w-2.5 h-2.5 text-[#8E929E] stroke-[2]" />
                  ) : (
                    <span className="text-[10px] opacity-20">•</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="pt-2 border-t border-[#282A30] flex items-center justify-center gap-4 text-[10px] text-[#8E929E]">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D4F63D]" />
          <span>Fait</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#252830] border border-[#343740]" />
          <span>Manqué</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#141518]" />
          <span>Non planifié</span>
        </div>
      </div>
    </div>
  );
};
