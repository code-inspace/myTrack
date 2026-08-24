"use client";

import React, { useState } from "react";
import { Task } from "@/features/tasks/types";
import { Project } from "../types";
import { ChevronRight, FolderKanban, Plus, Inbox, Pencil, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorityCardClass, getPriorityTitleClass, getPriorityIconColorClass } from "@/features/tasks/priority";

interface ProjectsListViewProps {
  projects: Project[];
  tasks: Task[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onEditProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({
  projects,
  tasks,
  onSelectProject,
  onOpenNewProject,
  onEditProject,
  onEditTask,
}) => {
  const [expandedUnassigned, setExpandedUnassigned] = useState(false);

  const tasksByProject = (projectId: string) => tasks.filter((t) => t.projectId === projectId && !t.isArchived);
  const unassignedTasks = tasks.filter((t) => !t.projectId && !t.isArchived);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-3 pb-36 space-y-3 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Projets</h2>
        <button
          type="button"
          onClick={onOpenNewProject}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-bold text-xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau projet</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="p-8 text-center bg-[#1C1D22] border border-[#282A30] rounded-3xl my-4">
          <FolderKanban className="w-10 h-10 text-[#6B7280] mx-auto mb-2" />
          <h4 className="text-base font-bold text-white">Aucun projet</h4>
          <p className="text-xs text-[#8E929E] mt-1 mb-4">Crée un projet pour organiser tes tâches.</p>
          <button
            type="button"
            onClick={onOpenNewProject}
            className="px-4 py-2 rounded-full bg-[#D4F63D] text-black font-bold text-xs cursor-pointer"
          >
            Créer un projet
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {projects.map((project) => {
            const projectTasks = tasksByProject(project.id);
            return (
              <div
                key={project.id}
                className="w-full flex items-center gap-2 p-4 rounded-2xl bg-[#1C1D22] hover:bg-[#22242B] border border-[#282A30] hover:border-[#383C48] transition-all"
              >
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  className="flex-1 min-w-0 flex items-center justify-between gap-3 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{project.name}</div>
                      <div className="text-[11px] text-[#8E929E]">
                        {projectTasks.length} tâche{projectTasks.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => onEditProject(project)}
                  title="Modifier le projet"
                  className="p-2 rounded-lg text-[#8E929E] hover:text-[#D4F63D] hover:bg-[#282A30] transition-colors cursor-pointer flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned tasks */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all mt-4">
        <button
          type="button"
          onClick={() => setExpandedUnassigned((v) => !v)}
          className="w-full p-3.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Inbox className="w-4 h-4 text-[#8E929E]" />
            <span className="text-xs font-bold text-white">Sans projet</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#8E929E] border border-[#2E323E]">
            {unassignedTasks.length}
          </span>
        </button>

        {expandedUnassigned && (
          <div className="p-3 pt-0 space-y-2 animate-in fade-in duration-150">
            {unassignedTasks.length === 0 ? (
              <p className="text-xs text-[#6B7280] px-1 py-2">Aucune tâche sans projet.</p>
            ) : (
              unassignedTasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl bg-[#1C1D22] hover:bg-[#282A30] border border-[#282A30] text-xs font-semibold text-white transition-all cursor-pointer truncate flex items-center gap-1.5",
                    getPriorityCardClass(task.priority),
                    getPriorityTitleClass(task.priority)
                  )}
                >
                  {task.priority && task.priority !== "NORMAL" && (
                    <Flame className={cn("w-3 h-3 flex-shrink-0", getPriorityIconColorClass(task.priority))} />
                  )}
                  <span className="truncate">{task.title}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
