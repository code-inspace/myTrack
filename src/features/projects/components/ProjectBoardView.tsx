"use client";

import React from "react";
import { Task } from "@/features/tasks/types";
import { Project, getProjectColumns } from "../types";
import { ArrowLeft, Plus } from "lucide-react";
import { BoardColumn, groupTasksByColumn } from "./KanbanBoard";
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
  onBack: () => void;
  onEditTask: (task: Task) => void;
  onChangeStatus: (taskId: string, status: string, isDoneColumn: boolean) => void;
  onAddTask: (projectId: string, status: string) => void;
}

export const ProjectBoardView: React.FC<ProjectBoardViewProps> = ({
  project,
  tasks,
  onBack,
  onEditTask,
  onChangeStatus,
  onAddTask,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const columns = getProjectColumns(project);
  const tasksByColumn = groupTasksByColumn(tasks, columns);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id);
    const task = tasks.find((t) => t.id === active.id);
    if (task && task.projectStatus !== newStatus) {
      const targetColumn = columns.find((c) => c.id === newStatus);
      onChangeStatus(String(active.id), newStatus, Boolean(targetColumn?.isDone));
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
        <h2 className="text-lg font-bold text-white truncate flex-1 min-w-0">{project.name}</h2>
        <button
          type="button"
          onClick={() => onAddTask(project.id, columns[0]?.id)}
          title="Nouvelle tâche"
          className="p-2 rounded-full bg-[#D4F63D] hover:bg-[#c2e42f] text-black transition-all cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
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
                onAddTask={(status) => onAddTask(project.id, status)}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
};
