"use client";

import React, { useState, useMemo } from "react";
import { Task, TaskWithCompletion } from "@/features/tasks/types";
import { TaskCard } from "../TaskCard";
import { ActiveTaskBanner } from "../ActiveTaskBanner";
import { DesktopWidgetsPane } from "./DesktopWidgetsPane";
import { DesktopDatePicker } from "./DesktopDatePicker";
import {
  CheckCircle2,
  Plus,
  Flame,
  Inbox,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

type FilterStatus = "all" | "active" | "urgent" | "todo" | "done";

interface DesktopTasksViewProps {
  tasks: TaskWithCompletion[];
  allTasks: Task[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  searchQuery: string;
  onNewTask: () => void;
  onEditTask: (task: TaskWithCompletion | Task) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleActive: (taskId: string) => void;
  onToggleReminder: (taskId: string) => void;
  onOpenLogModal: (task: TaskWithCompletion) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks: (taskIds: string[]) => void;
  onUpdateTaskStartedAt: (taskId: string, newTime: string) => void;
  quickTitle: string;
  onQuickTitleChange: (title: string) => void;
  onQuickAdd: (e: React.FormEvent) => void;
  onSelectTab?: (tab: any) => void;
  sleepDurationText?: string;
}

export const DesktopTasksView: React.FC<DesktopTasksViewProps> = ({
  tasks,
  allTasks,
  selectedDate,
  onSelectDate,
  searchQuery,
  onNewTask,
  onEditTask,
  onToggleComplete,
  onToggleActive,
  onToggleReminder,
  onOpenLogModal,
  onDeleteTask,
  onReorderTasks,
  onUpdateTaskStartedAt,
  quickTitle,
  onQuickTitleChange,
  onQuickAdd,
  onSelectTab,
  sleepDurationText,
}) => {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeTask = tasks.find((t) => t.isActive);

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: tasks.length,
      active: tasks.filter((t) => t.isActive).length,
      urgent: tasks.filter((t) => t.priority && t.priority !== "NORMAL" && !t.isCompletedToday).length,
      todo: tasks.filter((t) => !t.isCompletedToday).length,
      done: tasks.filter((t) => t.isCompletedToday).length,
    };
  }, [tasks]);

  // Filtered tasks according to search, status pill, category
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesCat = task.category?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat) return false;
      }

      // 2. Category Filter
      if (categoryFilter && task.category !== categoryFilter) {
        return false;
      }

      // 3. Status Pill
      if (statusFilter === "active") return task.isActive;
      if (statusFilter === "urgent") return task.priority && task.priority !== "NORMAL" && !task.isCompletedToday;
      if (statusFilter === "todo") return !task.isCompletedToday;
      if (statusFilter === "done") return task.isCompletedToday;

      return true;
    });
  }, [tasks, searchQuery, categoryFilter, statusFilter]);

  const orderedTasks = filteredTasks.filter((t) => !t.isActive);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedTasks.findIndex((t) => t.id === active.id);
    const newIndex = orderedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedTasks, oldIndex, newIndex);
    onReorderTasks(reordered.map((t) => t.id));
  };

  const formattedDate = useMemo(() => {
    try {
      const d = parseISO(selectedDate);
      return format(d, "EEEE d MMMM yyyy", { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 pt-2 pb-6 overflow-hidden">
      {/* 1. Header Section: Title, Subtitle, & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 select-none">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Ma Journée</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#D4F63D]/15 text-[#D4F63D] border border-[#D4F63D]/30 text-xs font-mono font-bold">
              Temps réel
            </span>
          </h1>
          <p className="text-xs text-[#8E929E] mt-0.5 capitalize">{formattedDate}</p>
        </div>

        {/* New Task button */}
        <button
          type="button"
          onClick={onNewTask}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-bold text-xs shadow-lg shadow-[#D4F63D]/15 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nouvelle tâche</span>
        </button>
      </div>

      {/* 2. Desktop Date Picker — with dropdown calendar */}
      <div className="pb-4">
        <DesktopDatePicker
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      </div>

      {/* 3. Filter Pills Bar (Inspired by the Reference screenshot's pill filters) */}
      <div className="flex items-center gap-2 pb-4 overflow-x-auto scrollbar-none select-none">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "all"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <span>Toutes</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "all" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "active"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <span>En cours</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "active" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.active}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("urgent")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "urgent"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <Flame className="w-3 h-3 text-[#F97316]" />
          <span>Prioritaires</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "urgent" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.urgent}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("todo")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "todo"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <span>À faire</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "todo" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.todo}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("done")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            statusFilter === "done"
              ? "bg-white text-black font-bold shadow-md shadow-white/10"
              : "bg-[#181920] border border-[#282A34] text-[#8E929E] hover:text-white hover:bg-[#20222B]"
          )}
        >
          <CheckCircle2 className="w-3 h-3 text-[#D4F63D]" />
          <span>Terminées</span>
          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px]", statusFilter === "done" ? "bg-black/15 text-black" : "bg-[#282A34] text-[#8E929E]")}>
            {counts.done}
          </span>
        </button>
      </div>

      {/* 3. Main Two-Column Layout (Left: Task Stream, Right: Intelligence Widgets) */}
      <div className="flex-1 min-h-0 flex items-start gap-6">
        {/* Left Pane: Tasks Workspace */}
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-y-auto scrollbar-none pr-2 space-y-4">
          {/* Quick Task Input Bar */}
          <form onSubmit={onQuickAdd} className="w-full relative select-none">
            <div className="relative flex items-center">
              <div className="absolute left-4 text-[#D4F63D]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Ajouter rapidement une tâche et appuyer sur Entrée..."
                value={quickTitle}
                onChange={(e) => onQuickTitleChange(e.target.value)}
                className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-[#17181F] border border-[#282B36] text-sm text-white focus:border-[#D4F63D] outline-none placeholder-[#6B7280] shadow-sm transition-all"
              />
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="absolute right-3 px-3 py-1.5 rounded-xl bg-[#D4F63D] text-black font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#c2e42f] transition-all cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </form>

          {/* Active Running Task Banner if any */}
          {activeTask && (
            <div className="space-y-3">
              <ActiveTaskBanner
                task={activeTask}
                onStop={(taskId) => onToggleActive(taskId)}
                onComplete={(taskId) => onToggleComplete(taskId)}
                onOpenLogModal={(t) => onOpenLogModal(t)}
                onUpdateStartTime={(taskId, newTime) =>
                  onUpdateTaskStartedAt(taskId, newTime)
                }
              />
            </div>
          )}

          {/* Tasks List */}
          <div className="space-y-3 pb-16">
            {orderedTasks.length === 0 ? (
              <div className="p-12 text-center bg-[#15161B] border border-[#242630] rounded-3xl my-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#20222B] border border-[#2E313D] flex items-center justify-center text-[#8E929E] mx-auto">
                  <Inbox className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Aucune tâche trouvée</h4>
                  <p className="text-xs text-[#8E929E] mt-1">
                    {searchQuery
                      ? "Aucun résultat pour cette recherche."
                      : "Aucune tâche pour les filtres sélectionnés."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onNewTask}
                  className="px-4 py-2 rounded-2xl bg-[#D4F63D] text-black font-bold text-xs cursor-pointer shadow-lg shadow-[#D4F63D]/20 transition-all hover:scale-105"
                >
                  Créer une tâche
                </button>
              </div>
            ) : (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2.5">
                    {orderedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        sortable
                        onToggleActive={onToggleActive}
                        onToggleComplete={onToggleComplete}
                        onToggleReminder={onToggleReminder}
                        onOpenLogModal={onOpenLogModal}
                        onEditTask={onEditTask}
                        onDeleteTask={onDeleteTask}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Right Pane: Live Intelligence & Control Widgets */}
        <DesktopWidgetsPane
          tasks={tasks}
          allTasks={allTasks}
          activeTask={activeTask}
          selectedDate={selectedDate}
          sleepDurationText={sleepDurationText}
          onOpenNewTask={onNewTask}
          onSelectTab={onSelectTab}
        />
      </div>
    </div>
  );
};
