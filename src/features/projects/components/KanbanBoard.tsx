"use client";

import React, { useState } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { ProjectColumn } from "../types";
import { ExternalCalendarEvent } from "@/features/calendar/types";
import { ExternalEventBoardCard } from "@/features/calendar/components/ExternalEventBoardCard";
import { GripVertical, CheckCircle2, Pencil, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/features/tasks/components/PriorityBadge";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { getTodayDateString } from "@/lib/dates";
import { format, parseISO, subDays } from "date-fns";

export interface ProjectBadge {
  name: string;
  color: string;
}

export type DonePeriodFilter = "1d" | "7d" | "30d";

export function isTaskDoneInPeriod(
  task: Task,
  completions: TaskCompletion[] | undefined,
  period: DonePeriodFilter,
  todayStr: string = getTodayDateString(),
): boolean {
  if (!task) return false;
  try {
    const today = parseISO(todayStr);
    const cutoff7d = format(subDays(today, 6), "yyyy-MM-dd");
    const cutoff30d = format(subDays(today, 29), "yyyy-MM-dd");

    const completedEntries = completions?.filter(
      (c) => c && c.taskId === task.id && c.completed,
    );

    if (completedEntries && completedEntries.length > 0) {
      if (period === "1d") {
        return completedEntries.some((c) => c.date === todayStr);
      }
      if (period === "7d") {
        return completedEntries.some((c) => c.date && c.date >= cutoff7d && c.date <= todayStr);
      }
      if (period === "30d") {
        return completedEntries.some((c) => c.date && c.date >= cutoff30d && c.date <= todayStr);
      }
    }

    const dateStr = (task.updatedAt || task.createdAt || todayStr).split("T")[0];
    if (period === "1d") {
      return dateStr === todayStr;
    }
    if (period === "7d") {
      return dateStr >= cutoff7d && dateStr <= todayStr;
    }
    if (period === "30d") {
      return dateStr >= cutoff30d && dateStr <= todayStr;
    }
  } catch {
    return true;
  }
  return true;
}

export const BoardCard: React.FC<{
  task: Task;
  onEditTask: (task: Task) => void;
  projectBadge?: ProjectBadge | null;
}> = ({ task, onEditTask, projectBadge }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={cn(
        "rounded-xl bg-[#1C1D22] border border-[#282A30] p-3 flex items-start gap-2 transition-all",
        isDragging ? "opacity-40 ring-2 ring-[#D4F63D]/50 z-10 relative" : ""
      )}
    >
      <div {...attributes} {...listeners} className="text-[#6B7280] cursor-grab active:cursor-grabbing mt-0.5 touch-none">
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      {task.priority && task.priority !== "NORMAL" && (
        <PriorityBadge priority={task.priority} className="mt-0.5 text-[#E5E7EB]" />
      )}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onEditTask(task)}
          className={cn(
            "block w-full text-left text-xs font-semibold text-white truncate cursor-pointer hover:text-[#D4F63D]"
          )}
        >
          {task.title}
        </button>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {projectBadge && (
            <span className="flex items-center gap-1 text-[10px] text-[#8E929E] truncate">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: projectBadge.color }}
              />
              <span className="truncate">{projectBadge.name}</span>
            </span>
          )}
          {task.projectCategory ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#A5B4FC]">
              <Tag className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{task.projectCategory}</span>
            </span>
          ) : (task.tag || task.category) ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-white/5 border border-white/10 text-[#A0A5B5]">
              <Tag className="w-2.5 h-2.5 flex-shrink-0 text-[#6B7280]" />
              <span className="truncate">{task.tag || task.category}</span>
            </span>
          ) : null}
          {task.projectCategory && (task.tag || task.category) && (task.tag || task.category) !== task.projectCategory && (task.tag || task.category) !== "General" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-white/5 border border-white/10 text-[#8E929E]">
              <span className="truncate">{task.tag || task.category}</span>
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onEditTask(task)}
        title="Modifier la tâche"
        className="p-1 rounded-lg text-[#6B7280] hover:text-[#D4F63D] hover:bg-[#22242B] transition-colors cursor-pointer flex-shrink-0"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
};

import {
  isExternalEventDone,
  isExternalEventInProgress,
  isEventInDonePeriod,
  isEventInRollingWeek
} from "@/features/calendar/lib/status";

export const BoardColumn: React.FC<{
  column: ProjectColumn;
  tasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  onEditTask: (task: Task) => void;
  onAddTask?: (columnId: string) => void;
  getBadge?: (task: Task) => ProjectBadge | null;
  completions?: TaskCompletion[];
  onSelectExternalEvent?: (event: ExternalCalendarEvent) => void;
}> = ({
  column,
  tasks,
  externalEvents = [],
  onEditTask,
  onAddTask,
  getBadge,
  completions,
  onSelectExternalEvent,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [donePeriod, setDonePeriod] = useState<DonePeriodFilter>("1d");

  const displayedTasks = column.isDone
    ? tasks.filter((t) => isTaskDoneInPeriod(t, completions, donePeriod))
    : tasks;

  // Filter external calendar events for this column
  const columnEvents = React.useMemo(() => {
    const todayStr = getTodayDateString();
    if (column.isDone) {
      return externalEvents.filter(
        (e) => isExternalEventDone(e, todayStr) && isEventInDonePeriod(e.date, donePeriod, todayStr)
      );
    }
    const isProgressColumn =
      column.id === "IN_PROGRESS" ||
      column.label.toLowerCase().includes("cours") ||
      column.id.toLowerCase().includes("progress");

    if (isProgressColumn) {
      return externalEvents.filter(
        (e) => e.date === todayStr && isExternalEventInProgress(e, todayStr)
      );
    }

    const isTodoColumn =
      column.id === "TODO" ||
      column.label.toLowerCase().includes("faire") ||
      column.id.toLowerCase().includes("todo");

    if (isTodoColumn) {
      return externalEvents.filter(
        (e) =>
          isEventInRollingWeek(e.date, todayStr) &&
          !isExternalEventDone(e, todayStr) &&
          !isExternalEventInProgress(e, todayStr)
      );
    }

    return [];
  }, [externalEvents, column, donePeriod]);

  const totalCount = displayedTasks.length + columnEvents.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[78vw] max-w-[280px] sm:w-64 max-h-full rounded-2xl bg-[#16171C] border p-2.5 flex flex-col transition-all",
        isOver ? "border-[#D4F63D]" : "border-[#23242A]"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1.5 flex-shrink-0">
        <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
          {column.isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#D4F63D] flex-shrink-0" />}
          {column.label}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#22242B] text-[#8E929E]">
            {totalCount}
          </span>
          {onAddTask && (
            <button
              type="button"
              onClick={() => onAddTask(column.id)}
              title={`Ajouter une tâche dans ${column.label}`}
              className="p-1 rounded-lg bg-[#22242B] hover:bg-[#D4F63D] text-[#8E929E] hover:text-black transition-all cursor-pointer flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {column.isDone && (
        <div className="flex items-center gap-1 p-0.5 mb-2 bg-[#101114] rounded-lg border border-[#23242A] flex-shrink-0">
          <button
            type="button"
            onClick={() => setDonePeriod("1d")}
            className={cn(
              "flex-1 py-1 text-[10px] font-medium rounded-md transition-all text-center cursor-pointer",
              donePeriod === "1d"
                ? "bg-[#22242B] text-[#D4F63D] font-bold shadow-sm"
                : "text-[#8E929E] hover:text-white"
            )}
          >
            Jour
          </button>
          <button
            type="button"
            onClick={() => setDonePeriod("7d")}
            className={cn(
              "flex-1 py-1 text-[10px] font-medium rounded-md transition-all text-center cursor-pointer",
              donePeriod === "7d"
                ? "bg-[#22242B] text-[#D4F63D] font-bold shadow-sm"
                : "text-[#8E929E] hover:text-white"
            )}
          >
            7 jours
          </button>
          <button
            type="button"
            onClick={() => setDonePeriod("30d")}
            className={cn(
              "flex-1 py-1 text-[10px] font-medium rounded-md transition-all text-center cursor-pointer",
              donePeriod === "30d"
                ? "bg-[#22242B] text-[#D4F63D] font-bold shadow-sm"
                : "text-[#8E929E] hover:text-white"
            )}
          >
            30 jours
          </button>
        </div>
      )}

      {totalCount > 0 ? (
        <div className="min-h-0 overflow-y-auto overscroll-contain space-y-2 p-0.5 -m-0.5">
          {/* External Calendar Events */}
          {columnEvents.map((evt) => (
            <ExternalEventBoardCard
              key={evt.id}
              event={evt}
              targetDateStr={getTodayDateString()}
              onClick={() => onSelectExternalEvent?.(evt)}
            />
          ))}

          {/* Tasks */}
          {displayedTasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              onEditTask={onEditTask}
              projectBadge={getBadge?.(task) ?? null}
            />
          ))}
        </div>
      ) : (
        column.isDone && (
          <div className="text-[11px] text-[#6B7280] text-center py-6 italic">
            Aucun élément terminé
          </div>
        )
      )}
    </div>
  );
};

/**
 * Groups tasks by column id:
 * - Completed tasks are strictly placed in the done column.
 * - Tasks whose stored status doesn't match any given column fall into the first column.
 */
export function groupTasksByColumn(
  tasks: Task[],
  columns: ProjectColumn[],
  completions?: TaskCompletion[],
): Map<string, Task[]> {
  const columnIds = new Set(columns.map((c) => c.id));
  const doneColumn = columns.find((c) => c.isDone) || columns[columns.length - 1];
  const firstColumn = columns[0];
  const groups = new Map<string, Task[]>(columns.map((c) => [c.id, []]));

  tasks.forEach((task) => {
    const isCompleted = Boolean(
      completions?.some((c) => c.taskId === task.id && c.completed) ||
      task.projectStatus === "DONE" ||
      (doneColumn && task.projectStatus === doneColumn.id),
    );

    let bucket: string | undefined;

    if (isCompleted && doneColumn) {
      bucket = doneColumn.id;
    } else {
      let status = task.projectStatus;
      if (status === "DONE" && doneColumn && !columnIds.has("DONE")) {
        status = doneColumn.id;
      }
      bucket = status && columnIds.has(status) ? status : firstColumn?.id;
    }

    if (bucket && groups.has(bucket)) {
      groups.get(bucket)!.push(task);
    }
  });

  return groups;
}

