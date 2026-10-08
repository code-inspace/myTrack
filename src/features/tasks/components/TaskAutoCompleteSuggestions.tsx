import React, { useEffect, useMemo, useRef } from "react";
import { PriorityBadge } from "./PriorityBadge";
import { Task } from "@/features/tasks/types";
import { Project } from "@/features/projects/types";
import { cn } from "@/lib/utils";
import {
  Repeat,
  Play,
  Bell,
  Tag,
  Sparkles,
  CheckCircle2,
  } from "lucide-react";

interface TaskAutoCompleteSuggestionsProps {
  query: string;
  allTasks: Task[];
  projects: Project[];
  isOpen: boolean;
  selectedIndex: number;
  onSelectSuggestion: (task: Task, autoStart?: boolean) => void;
  onClose: () => void;
  setSelectedIndex?: (index: number) => void;
  className?: string;
}

export const TaskAutoCompleteSuggestions: React.FC<TaskAutoCompleteSuggestionsProps> = ({
  query,
  allTasks,
  projects,
  isOpen,
  selectedIndex,
  onSelectSuggestion,
  onClose,
  setSelectedIndex,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and rank matching tasks from history
  const matchingTasks = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const taskMap = new Map<string, Task>();

    for (const t of allTasks) {
      if (!t.title) continue;
      const titleClean = t.title.trim().toLowerCase();
      if (titleClean.includes(cleanQuery)) {
        const existing = taskMap.get(titleClean);
        if (!existing) {
          taskMap.set(titleClean, t);
        } else {
          // Keep the richer version (with project, description, reminders, etc.) or more recently updated
          const existingScore =
            (existing.projectId ? 3 : 0) +
            (existing.projectCategory ? 2 : 0) +
            (existing.description ? 1 : 0) +
            (existing.enableReminders ? 1 : 0) +
            (existing.priority && existing.priority !== "NORMAL" ? 1 : 0);

          const currentScore =
            (t.projectId ? 3 : 0) +
            (t.projectCategory ? 2 : 0) +
            (t.description ? 1 : 0) +
            (t.enableReminders ? 1 : 0) +
            (t.priority && t.priority !== "NORMAL" ? 1 : 0);

          if (
            currentScore > existingScore ||
            (currentScore === existingScore &&
              new Date(t.updatedAt || t.createdAt || 0).getTime() >
                new Date(existing.updatedAt || existing.createdAt || 0).getTime())
          ) {
            taskMap.set(titleClean, t);
          }
        }
      }
    }

    // Rank matching tasks
    const sorted = Array.from(taskMap.values()).sort((a, b) => {
      const aLower = a.title.trim().toLowerCase();
      const bLower = b.title.trim().toLowerCase();

      // 1. Exact match first
      if (aLower === cleanQuery && bLower !== cleanQuery) return -1;
      if (bLower === cleanQuery && aLower !== cleanQuery) return 1;

      // 2. Starts with query second
      if (aLower.startsWith(cleanQuery) && !bLower.startsWith(cleanQuery)) return -1;
      if (bLower.startsWith(cleanQuery) && !aLower.startsWith(cleanQuery)) return 1;

      return a.title.localeCompare(b.title);
    });

    return sorted.slice(0, 5);
  }, [allTasks, query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || matchingTasks.length === 0) {
    return null;
  }

  const highlightMatch = (text: string, q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return text;
    const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + trimmed.length);
    const after = text.substring(index + trimmed.length);

    return (
      <>
        {before}
        <span className="text-[#D4F63D] font-bold underline decoration-[#D4F63D]/40 underline-offset-2">
          {match}
        </span>
        {after}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Suggestions d'auto-complétion"
      className={cn(
        "absolute top-full left-0 right-0 mt-2 z-50 bg-[#15161C]/95 backdrop-blur-xl border border-[#2B2E3B] rounded-2xl shadow-2xl p-1.5 space-y-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 select-none",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#242732] text-[11px] text-[#8E929E]">
        <div className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-[#D4F63D]" />
          <span>Tâche existante détectée • Répéter l&apos;habitude</span>
        </div>
        <span className="text-[10px] text-[#6B7280]">
          Entrée pour valider • ↑↓ naviguer
        </span>
      </div>

      {/* Suggestions List */}
      <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-none py-0.5">
        {matchingTasks.map((task, idx) => {
          const isSelected = selectedIndex === idx;
          const project = task.projectId
            ? projects.find((p) => p.id === task.projectId)
            : null;

          const isUrgent =
            task.priority === "URGENT" || task.priority === "VERY_URGENT";
          const isHigh = task.priority === "HIGH";

          const hasReminders =
            Boolean(task.enableReminders) &&
            (task.reminderOffsetMinutes !== undefined ||
              (task.reminderTimes && task.reminderTimes.length > 0));

          return (
            <div
              key={task.id}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setSelectedIndex?.(idx)}
              onClick={() => onSelectSuggestion(task, false)}
              className={cn(
                "group relative rounded-xl p-2.5 text-left flex flex-col gap-1.5 transition-all cursor-pointer border",
                isSelected
                  ? "bg-[#20232E] border-[#3D4253] shadow-md"
                  : "bg-transparent border-transparent hover:bg-[#1A1C24] hover:border-[#282B37]"
              )}
            >
              {/* Row 1: Title + Quick actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-[#D4F63D]/10 text-[#D4F63D] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-bold text-white truncate group-hover:text-[#D4F63D] transition-colors">
                    {highlightMatch(task.title, query)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectSuggestion(task, true);
                    }}
                    title="Répéter et démarrer immédiatement"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-[11px] shadow transition-all active:scale-95 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Démarrer</span>
                  </button>
                </div>
              </div>

              {/* Description preview if present */}
              {task.description && (
                <p className="text-[11px] text-[#9CA3AF] line-clamp-1 italic pl-8">
                  &ldquo;{task.description}&rdquo;
                </p>
              )}

              {/* Row 2: Metadata pills (Project, Sub-project, Category, Priority, Reminders, Habit badge) */}
              <div className="flex flex-wrap items-center gap-1.5 pl-8 text-[10px]">
                {/* Project Badge */}
                {project && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111216] border border-[#2B2E3A] text-white font-semibold shadow-sm">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color || "#D4F63D" }}
                    />
                    <span className="truncate max-w-[100px]">{project.name}</span>
                    {task.projectCategory && (
                      <span className="text-[#9CA3AF] font-normal border-l border-[#383C4A] pl-1 ml-0.5">
                        {task.projectCategory}
                      </span>
                    )}
                  </span>
                )}

                {/* Category / Tag */}
                {(task.tag || task.category) && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#222530] text-[#A0A4B2] font-medium border border-[#2E3240]">
                    <Tag className="w-2.5 h-2.5 text-[#8E929E]" />
                    <span>{task.tag || task.category}</span>
                  </span>
                )}

                {/* Priority */}
                {isUrgent && <PriorityBadge priority={task.priority} size="xs" className="text-[#E5E7EB]" />}
                {isHigh && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                    <span>Haute</span>
                  </span>
                )}

                {/* Reminders */}
                {hasReminders && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#D4F63D]/10 border border-[#D4F63D]/25 text-[#D4F63D] font-semibold">
                    <Bell className="w-2.5 h-2.5 fill-[#D4F63D]/20" />
                    <span>
                      {task.reminderOffsetMinutes !== undefined && task.reminderOffsetMinutes !== null
                        ? `${task.reminderOffsetMinutes}m avant`
                        : task.reminderTimes?.[0] || "Rappel actif"}
                    </span>
                  </span>
                )}

                {/* Habit indicator */}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#60A5FA] font-bold ml-auto">
                  <Repeat className="w-2.5 h-2.5" />
                  <span>Habitude récurrente</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
