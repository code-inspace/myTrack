"use client";

import React, { useMemo, useState } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { TASK_CATEGORIES } from "@/features/tasks/options";
import { Project, DEFAULT_PROJECT_COLUMNS } from "../types";
import { BoardColumn, groupTasksByColumn } from "./KanbanBoard";
import { ArrowLeft } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import { ExternalCalendarEvent } from "@/features/calendar/types";

interface AllProjectsBoardViewProps {
  projects: Project[];
  tasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  completions?: TaskCompletion[];
  onBack: () => void;
  onEditTask: (task: Task) => void;
  onAddTask?: (columnId: string) => void;
  onChangeStatus: (taskId: string, status: string, isDoneColumn: boolean, wasDoneColumn: boolean) => void;
  onSelectExternalEvent?: (event: ExternalCalendarEvent) => void;
}

const NO_PROJECT_FILTER = "__none__";

export const AllProjectsBoardView: React.FC<AllProjectsBoardViewProps> = ({
  projects,
  tasks,
  externalEvents = [],
  completions,
  onBack,
  onEditTask,
  onAddTask,
  onChangeStatus,
  onSelectExternalEvent,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const columns = DEFAULT_PROJECT_COLUMNS;

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.isArchived)
      .filter((t) => (categoryFilter ? t.category === categoryFilter : true))
      .filter((t) => {
        if (!projectFilter) return true;
        if (projectFilter === NO_PROJECT_FILTER) return !t.projectId;
        return t.projectId === projectFilter;
      });
  }, [tasks, categoryFilter, projectFilter]);

  const tasksByColumn = groupTasksByColumn(filteredTasks, columns, completions);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id);
    const task = filteredTasks.find((t) => t.id === active.id);
    if (task && task.projectStatus !== newStatus) {
      const targetColumn = columns.find((c) => c.id === newStatus);
      const previousColumn = columns.find((c) => c.id === task.projectStatus);
      onChangeStatus(String(active.id), newStatus, Boolean(targetColumn?.isDone), Boolean(previousColumn?.isDone));
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-[#17181F] flex-shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full bg-[#1C1D22] hover:bg-[#22242B] border border-[#282A30] text-[#8E929E] hover:text-white transition-all cursor-pointer md:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight truncate">Toutes les tâches</h2>
            <p className="text-xs text-[#8E929E] mt-0.5 hidden md:block">Vue Kanban consolidée de tous les projets</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#17181F] border border-[#282B36] text-white text-xs font-semibold outline-none focus:border-[#D4F63D] cursor-pointer"
          >
            <option value="">Toutes catégories</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#17181F] border border-[#282B36] text-white text-xs font-semibold outline-none focus:border-[#D4F63D] cursor-pointer"
          >
            <option value="">Tous les projets</option>
            <option value={NO_PROJECT_FILTER}>Sans projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pb-28">
          <div className="flex items-start gap-3 h-full">
            {columns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn.get(col.id) || []}
                externalEvents={externalEvents}
                onEditTask={onEditTask}
                onAddTask={onAddTask}
                completions={completions}
                onSelectExternalEvent={onSelectExternalEvent}
                getBadge={(t) => {
                  const p = t.projectId ? projectById.get(t.projectId) : null;
                  return p ? { name: p.name, color: p.color } : null;
                }}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
};
