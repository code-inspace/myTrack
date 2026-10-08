"use client";

import React, { useMemo, useState } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { TASK_CATEGORIES } from "@/features/tasks/options";
import {
  Project,
  ProjectColumn,
  getProjectColumns,
  resolveAllBoardColumnId,
  resolveStatusForAllBoardColumn,
} from "../types";
import { BoardColumn } from "./KanbanBoard";
import { ColumnsEditor } from "./ColumnsEditor";
import { useAllProjectsBoardColumns } from "../allBoardColumns";
import { useAuth } from "@/providers/AuthProvider";
import { ArrowLeft, Calendar, Columns3, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [showCalendar, setShowCalendar] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mytrack_show_calendar_in_projects") !== "false";
    }
    return true;
  });

  const toggleCalendarVisibility = () => {
    setShowCalendar((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("mytrack_show_calendar_in_projects", String(next));
      }
      return next;
    });
  };

  const { user } = useAuth();
  const { columns: storedColumns, saveColumns } = useAllProjectsBoardColumns(user?.id);
  const columns = useMemo(() => getProjectColumns({ columns: storedColumns }), [storedColumns]);
  const [isEditingColumns, setIsEditingColumns] = useState(false);
  const [draftColumns, setDraftColumns] = useState<ProjectColumn[]>([]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const isTaskCompleted = (task: Task) =>
    Boolean(completions?.some((c) => c.taskId === task.id && c.completed));
  const boardColumnOf = (task: Task) =>
    resolveAllBoardColumnId(
      task,
      columns,
      task.projectId ? projectById.get(task.projectId) : null,
      isTaskCompleted(task),
    );

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

  const tasksByColumn = useMemo(() => {
    const groups = new Map<string, Task[]>(columns.map((c) => [c.id, []]));
    for (const task of filteredTasks) {
      const bucket = boardColumnOf(task);
      if (bucket && groups.has(bucket)) groups.get(bucket)!.push(task);
    }
    return groups;
    // boardColumnOf only reads columns / projectById / completions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, columns, projectById, completions]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id);
    const task = filteredTasks.find((t) => t.id === active.id);
    if (!task) return;

    const targetColumn = columns.find((c) => c.id === newStatus);
    if (!targetColumn) return;

    // Moves are expressed in the task's own project columns (same id, same name, or done)
    const currentBoardColumnId = boardColumnOf(task);
    if (currentBoardColumnId !== targetColumn.id) {
      const project = task.projectId ? projectById.get(task.projectId) : null;
      const doneBoardColumnId = columns.find((c) => c.isDone)?.id;
      onChangeStatus(
        String(active.id),
        resolveStatusForAllBoardColumn(task, targetColumn, project),
        Boolean(targetColumn.isDone),
        currentBoardColumnId === doneBoardColumnId,
      );
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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            data-testid="all-projects-edit-columns"
            onClick={() => {
              setDraftColumns(columns);
              setIsEditingColumns(true);
            }}
            title="Modifier les colonnes de ce tableau"
            className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer border bg-[#17181F] border-[#282B36] text-[#8E929E] hover:text-white hover:bg-[#22242C]"
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>Colonnes</span>
          </button>
          <button
            type="button"
            onClick={toggleCalendarVisibility}
            title={showCalendar ? "Masquer les événements d'agenda externe" : "Afficher les événements d'agenda externe"}
            className={cn(
              "h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer border",
              showCalendar
                ? "bg-[#3B82F6]/15 border-[#3B82F6]/40 text-[#60A5FA]"
                : "bg-[#17181F] border-[#282B36] text-[#6B7280] hover:text-[#9CA3AF]"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Agenda {showCalendar ? "ON" : "OFF"}</span>
          </button>

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
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pb-36 md:pb-8">
          <div className="flex items-start gap-3 h-full">
            {columns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn.get(col.id) || []}
                externalEvents={showCalendar ? externalEvents : []}
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

      {isEditingColumns && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditingColumns(false);
          }}
        >
          <div
            data-testid="all-projects-columns-modal"
            className="modal-adaptive-card w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Colonnes de « Tous les projets »</h3>
                <p className="text-[11px] text-[#8E929E] mt-1 leading-snug">
                  Une tâche se range dans la colonne qui porte le même nom que sa colonne dans son projet.
                  Les colonnes « Fait » se correspondent toujours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingColumns(false)}
                className="p-2 rounded-full bg-[#252830] text-[#8E929E] hover:text-white cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ColumnsEditor columns={draftColumns} onChange={setDraftColumns} title="Colonnes du tableau" />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingColumns(false)}
                className="px-4 py-2 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#8E929E] hover:text-white text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="all-projects-columns-save"
                onClick={async () => {
                  await saveColumns(draftColumns);
                  setIsEditingColumns(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#D4F63D] hover:bg-[#c5e636] text-black text-xs font-bold cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
