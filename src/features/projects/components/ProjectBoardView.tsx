"use client";

import React from "react";
import { Task } from "@/features/tasks/types";
import { Project, ProjectColumn, getProjectColumns } from "../types";
import { ArrowLeft, GripVertical, Plus, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorityCardClass, getPriorityTitleClass, getPriorityIconColorClass } from "@/features/tasks/priority";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

interface ProjectBoardViewProps {
  project: Project;
  tasks: Task[];
  onBack: () => void;
  onEditTask: (task: Task) => void;
  onChangeStatus: (taskId: string, status: string) => void;
  onAddTask: (projectId: string, status: string) => void;
}

const BoardCard: React.FC<{ task: Task; onEditTask: (task: Task) => void }> = ({ task, onEditTask }) => {
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
      <button
        type="button"
        onClick={() => onEditTask(task)}
        className={cn(
          "flex-1 min-w-0 text-left text-xs font-semibold text-white truncate cursor-pointer hover:text-[#D4F63D]",
          getPriorityTitleClass(task.priority)
        )}
      >
        {task.title}
      </button>
    </div>
  );
};

const BoardColumn: React.FC<{
  column: ProjectColumn;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTask: (status: string) => void;
}> = ({ column, tasks, onEditTask, onAddTask }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[78vw] max-w-[280px] sm:w-64 rounded-2xl bg-[#16171C] border p-2.5 space-y-2 transition-all",
        isOver ? "border-[#D4F63D]" : "border-[#23242A]"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-bold text-white truncate">{column.label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#22242B] text-[#8E929E]">
            {tasks.length}
          </span>
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            title="Ajouter une tâche dans cette colonne"
            className="p-1 rounded-lg text-[#8E929E] hover:text-[#D4F63D] hover:bg-[#22242B] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-2 min-h-[40px]">
        {tasks.map((task) => (
          <BoardCard key={task.id} task={task} onEditTask={onEditTask} />
        ))}
      </div>
    </div>
  );
};

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
  const columnIds = columns.map((c) => c.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id);
    const task = tasks.find((t) => t.id === active.id);
    if (task && task.projectStatus !== newStatus) {
      onChangeStatus(String(active.id), newStatus);
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pb-6">
          <div className="flex items-start gap-3 h-full">
            {columns.map((col, idx) => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={tasks.filter((t) =>
                  idx === 0
                    ? t.projectStatus === col.id || !t.projectStatus || !columnIds.includes(t.projectStatus)
                    : t.projectStatus === col.id
                )}
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
