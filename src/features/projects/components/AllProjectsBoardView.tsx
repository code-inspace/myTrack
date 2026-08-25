"use client";

import React, { useMemo, useState } from "react";
import { Task } from "@/features/tasks/types";
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

interface AllProjectsBoardViewProps {
  projects: Project[];
  tasks: Task[];
  onBack: () => void;
  onEditTask: (task: Task) => void;
  onChangeStatus: (taskId: string, status: string, isDoneColumn: boolean, wasDoneColumn: boolean) => void;
}

const NO_PROJECT_FILTER = "__none__";

export const AllProjectsBoardView: React.FC<AllProjectsBoardViewProps> = ({
  projects,
  tasks,
  onBack,
  onEditTask,
  onChangeStatus,
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

  const tasksByColumn = groupTasksByColumn(filteredTasks, columns);

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
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full bg-[#1C1D22] hover:bg-[#22242B] border border-[#282A30] text-[#8E929E] hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-bold text-white truncate">Tous les projets</h2>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flex-1 h-9 px-2.5 rounded-xl bg-[#1C1D22] border border-[#282A30] text-white text-xs outline-none focus:border-[#D4F63D] cursor-pointer"
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
          className="flex-1 h-9 px-2.5 rounded-xl bg-[#1C1D22] border border-[#282A30] text-white text-xs outline-none focus:border-[#D4F63D] cursor-pointer"
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pb-28">
          <div className="flex items-start gap-3 h-full">
            {columns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn.get(col.id) || []}
                onEditTask={onEditTask}
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
