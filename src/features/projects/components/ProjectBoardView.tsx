"use client";

import React, { useState, useMemo } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { Project, getProjectColumns } from "../types";
import { ArrowLeft, Tag, Calendar } from "lucide-react";
import { BoardColumn, groupTasksByColumn } from "./KanbanBoard";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import { ExternalCalendarEvent } from "@/features/calendar/types";

interface ProjectBoardViewProps {
  project: Project;
  tasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  completions?: TaskCompletion[];
  onBack: () => void;
  onEditTask: (task: Task) => void;
  onAddTask?: (columnId: string) => void;
  onChangeStatus: (taskId: string, status: string, isDoneColumn: boolean, wasDoneColumn: boolean) => void;
  onSelectExternalEvent?: (event: ExternalCalendarEvent) => void;
}

export const ProjectBoardView: React.FC<ProjectBoardViewProps> = ({
  project,
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
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const projectEvents = useMemo(() => {
    return externalEvents.filter((e) => e.projectId === project.id);
  }, [externalEvents, project.id]);

  const projectCategories = useMemo(() => {
    const cats = new Set<string>(project.categories || []);
    tasks.forEach((t) => {
      if (t.projectCategory) cats.add(t.projectCategory);
    });
    projectEvents.forEach((e) => {
      if (e.projectCategory) cats.add(e.projectCategory);
    });
    return Array.from(cats);
  }, [project, tasks, projectEvents]);

  const filteredTasks = useMemo(() => {
    if (selectedCategory === "ALL") return tasks;
    return tasks.filter((t) => (t.projectCategory || "Général") === selectedCategory);
  }, [tasks, selectedCategory]);

  const filteredEvents = useMemo(() => {
    if (selectedCategory === "ALL") return projectEvents;
    return projectEvents.filter((e) => (e.projectCategory || "Général") === selectedCategory);
  }, [projectEvents, selectedCategory]);

  const totalElementsCount = filteredTasks.length + filteredEvents.length;

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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#17181F] flex-shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full bg-[#1C1D22] hover:bg-[#22242B] border border-[#282A30] text-[#8E929E] hover:text-white transition-all cursor-pointer md:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight truncate">{project.name}</h2>
            <p className="text-xs text-[#8E929E] mt-0.5 hidden md:block">Tableau Kanban du projet</p>
          </div>
        </div>

        <div className="text-xs font-semibold text-[#8E929E] bg-[#17181F] px-3 py-1.5 rounded-xl border border-[#282B36]">
          {totalElementsCount} élément{totalElementsCount !== 1 ? "s" : ""}
        </div>
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
            Tous ({tasks.length + projectEvents.length})
          </button>
          {projectCategories.map((cat) => {
            const count =
              tasks.filter((t) => (t.projectCategory || "Général") === cat).length +
              projectEvents.filter((e) => (e.projectCategory || "Général") === cat).length;
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
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pb-36 md:pb-8">
          <div className="flex items-start gap-3 h-full">
            {columns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn.get(col.id) || []}
                externalEvents={filteredEvents}
                onEditTask={onEditTask}
                onAddTask={onAddTask}
                completions={completions}
                onSelectExternalEvent={onSelectExternalEvent}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
};
