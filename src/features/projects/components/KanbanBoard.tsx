"use client";

import React from "react";
import { Task } from "@/features/tasks/types";
import { ProjectColumn } from "../types";
import { GripVertical, Plus, Flame, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorityCardClass, getPriorityTitleClass, getPriorityIconColorClass } from "@/features/tasks/priority";
import { useDraggable, useDroppable } from "@dnd-kit/core";

export interface ProjectBadge {
  name: string;
  color: string;
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
        touchAction: "none",
      }}
      className={cn(
        "rounded-xl bg-[#1C1D22] border border-[#282A30] p-3 flex items-start gap-2 transition-all",
        isDragging ? "opacity-40 ring-2 ring-[#D4F63D]/50 z-10 relative" : "",
        getPriorityCardClass(task.priority)
      )}
    >
      <div {...attributes} {...listeners} className="text-[#6B7280] cursor-grab active:cursor-grabbing mt-0.5 touch-none">
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      {task.priority && task.priority !== "NORMAL" && (
        <Flame className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", getPriorityIconColorClass(task.priority))} />
      )}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onEditTask(task)}
          className={cn(
            "block w-full text-left text-xs font-semibold text-white truncate cursor-pointer hover:text-[#D4F63D]",
            getPriorityTitleClass(task.priority)
          )}
        >
          {task.title}
        </button>
        {projectBadge && (
          <span className="mt-1 flex items-center gap-1 text-[10px] text-[#8E929E] truncate">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: projectBadge.color }}
            />
            <span className="truncate">{projectBadge.name}</span>
          </span>
        )}
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

export const BoardColumn: React.FC<{
  column: ProjectColumn;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTask?: (status: string) => void;
  getBadge?: (task: Task) => ProjectBadge | null;
}> = ({ column, tasks, onEditTask, onAddTask, getBadge }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[78vw] max-w-[280px] sm:w-64 h-full rounded-2xl bg-[#16171C] border p-2.5 flex flex-col transition-all",
        isOver ? "border-[#D4F63D]" : "border-[#23242A]"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1 flex-shrink-0">
        <span className="text-xs font-bold text-white truncate flex items-center gap-1">
          {column.isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#D4F63D] flex-shrink-0" />}
          {column.label}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#22242B] text-[#8E929E]">
            {tasks.length}
          </span>
          {onAddTask && (
            <button
              type="button"
              onClick={() => onAddTask(column.id)}
              title="Ajouter une tâche dans cette colonne"
              className="p-1 rounded-lg text-[#8E929E] hover:text-[#D4F63D] hover:bg-[#22242B] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-[40px] overflow-y-auto space-y-2 pr-0.5">
        {tasks.map((task) => (
          <BoardCard key={task.id} task={task} onEditTask={onEditTask} projectBadge={getBadge?.(task) ?? null} />
        ))}
      </div>
    </div>
  );
};

/**
 * Groups tasks by column id: the first column also absorbs tasks whose stored status doesn't
 * match any of the given columns (e.g. an orphaned status after a column was renamed/removed,
 * or — on an aggregated board — a task assigned to a project with a different custom scheme).
 */
export function groupTasksByColumn(tasks: Task[], columns: ProjectColumn[]): Map<string, Task[]> {
  const columnIds = new Set(columns.map((c) => c.id));
  const groups = new Map<string, Task[]>(columns.map((c) => [c.id, []]));

  tasks.forEach((task) => {
    const status = task.projectStatus;
    const bucket = status && columnIds.has(status) ? status : columns[0]?.id;
    if (bucket) groups.get(bucket)!.push(task);
  });

  return groups;
}
