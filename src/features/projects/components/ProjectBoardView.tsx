"use client";

import React, { useState, useMemo } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { Project, getProjectColumns } from "../types";
import { ArrowLeft, Tag } from "lucide-react";
import { BoardColumn, groupTasksByColumn } from "./KanbanBoard";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

interface ProjectBoardViewProps {
  project: Project;
  tasks: Task[];
  completions?: TaskCompletion[];
  onBack: () => void;
  onEditTask: (task: Task) => void;
  onAddTask?: (columnId: string) => void;
  onChangeStatus: (taskId: string, status: string, isDoneColumn: boolean, wasDoneColumn: boolean) => void;
}

export const ProjectBoardView: React.FC<ProjectBoardViewProps> = ({
  project,
  tasks,
  completions,
  onBack,
  onEditTask,
  onAddTask,
  onChangeStatus,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const projectCategories = useMemo(() => {
    const cats = new Set<string>(project.categories || []);
    tasks.forEach((t) => {
      if (t.projectCategory) cats.add(t.projectCategory);
    });
    return Array.from(cats);
  }, [project, tasks]);

  const filteredTasks = useMemo(() => {
    if (selectedCategory === "ALL") return tasks;
    return tasks.filter((t) => t.projectCategory === selectedCategory);
  }, [tasks, selectedCategory]);

  const columns = getProjectColumns(project);
  const tasksByColumn = groupTasksByColumn(filteredTasks, columns, completions);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id);
    const task = tasks.find((t) => t.id === active.id);
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
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
        <h2 className="text-lg font-bold text-white truncate">{project.name}</h2>
      </div>

      {/* Project Categories Filter Bar */}
      {projectCategories.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
              selectedCategory === "ALL"
                ? "bg-[#D4F63D] text-black font-bold shadow-sm"
                : "bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white hover:border-[#4B5563]"
            )}
          >
            Toutes ({tasks.length})
          </button>
          {projectCategories.map((cat) => {
            const count = tasks.filter((t) => t.projectCategory === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                  isSelected
                    ? "bg-[#818CF8] text-black font-bold shadow-sm"
                    : "bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white hover:border-[#4B5563]"
                )}
              >
                <Tag className="w-3 h-3" />
                <span>{cat}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pb-28">
          <div className="flex items-start gap-3 h-full">
            {columns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn.get(col.id) || []}
                onEditTask={onEditTask}
                onAddTask={onAddTask}
                completions={completions}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
};
