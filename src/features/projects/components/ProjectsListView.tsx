"use client";

import React from "react";
import { Task } from "@/features/tasks/types";
import { Project } from "../types";
import { ChevronRight, FolderKanban, Plus, Pencil, LayoutGrid } from "lucide-react";

interface ProjectsListViewProps {
  projects: Project[];
  tasks: Task[];
  onSelectProject: (projectId: string) => void;
  onOpenAllProjectsBoard: () => void;
  onOpenNewProject: () => void;
  onEditProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
  isInitialLoading?: boolean;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({
  projects,
  tasks,
  onSelectProject,
  onOpenAllProjectsBoard,
  onOpenNewProject,
  onEditProject,
  onEditTask,
  isInitialLoading = false,
}) => {
  const tasksByProject = (projectId: string) => tasks.filter((t) => t.projectId === projectId && !t.isArchived);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-3 pb-44 space-y-3 max-w-md mx-auto w-full">
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

      <div className="grid grid-cols-1 gap-2.5">
        <button
          type="button"
          onClick={onOpenAllProjectsBoard}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#1C1D22] hover:bg-[#22242B] border border-[#282A30] hover:border-[#383C48] transition-all cursor-pointer text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-[#D4F63D]/10 border border-[#D4F63D]/20 flex items-center justify-center text-[#D4F63D] flex-shrink-0">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Tous les projets</div>
            <div className="text-[11px] text-[#8E929E]">Toutes les tâches, filtrables par catégorie ou projet</div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
        </button>
      </div>

      {isInitialLoading && projects.length === 0 ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#1C1D22] border border-[#282A30] animate-pulse"
            >
              <div className="w-3 h-3 rounded-full bg-white/10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-white/10 rounded w-1/3" />
                <div className="h-2.5 bg-white/5 rounded w-1/5" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
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
    </div>
  );
};
