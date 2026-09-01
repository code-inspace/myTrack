"use client";

import React, { useState } from "react";
import { Task, TaskCompletion } from "@/features/tasks/types";
import { useTaskMutations } from "@/features/tasks/hooks";
import { getTodayDateString } from "@/lib/dates";
import { useProjects, useProjectMutations } from "../hooks";
import { Project } from "../types";
import { ProjectsListView } from "./ProjectsListView";
import { ProjectBoardView } from "./ProjectBoardView";
import { AllProjectsBoardView } from "./AllProjectsBoardView";
import { ProjectFormModal } from "./ProjectFormModal";
import { ChevronRight, FolderKanban, Plus, Pencil, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

import { ExternalCalendarEvent } from "@/features/calendar/types";
import { ExternalEventDetailModal } from "@/features/calendar/components/ExternalEventDetailModal";

interface ProjectsViewProps {
  allTasks: Task[];
  externalEvents?: ExternalCalendarEvent[];
  completions?: TaskCompletion[];
  onEditTask: (task: Task) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  allTasks = [],
  externalEvents = [],
  completions = [],
  onEditTask,
}) => {
  const todayStr = getTodayDateString();

  const { projects } = useProjects();
  const { createProject, updateProject } = useProjectMutations();
  const { updateTask, closeTask, reopenTask } = useTaskMutations();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAllProjectsBoard, setShowAllProjectsBoard] = useState(true); // Default to true on desktop
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState<ExternalCalendarEvent | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const closeProjectModal = () => {
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleChangeStatus = (
    taskId: string,
    status: string,
    isDoneColumn: boolean,
    wasDoneColumn: boolean,
  ) => {
    if (isDoneColumn) {
      updateTask.mutate({ taskId, values: { projectStatus: status } });
      closeTask.mutate({ taskId, date: todayStr });
    } else if (wasDoneColumn) {
      reopenTask.mutate({
        taskId,
        date: todayStr,
        skipProjectStatusReset: true,
        reopenAllDates: true,
      });
      updateTask.mutate({
        taskId,
        values: { projectStatus: status, date: todayStr },
      });
    } else {
      updateTask.mutate({ taskId, values: { projectStatus: status } });
    }
  };

  const tasksByProject = (projectId: string) => allTasks.filter((t) => t.projectId === projectId && !t.isArchived);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full relative">
      {/* MOBILE VERSION: Back-and-forth screens (hidden on desktop) */}
      <div className="flex-1 flex flex-col min-h-0 md:hidden">
        {selectedProjectId ? (
          selectedProject && (
            <ProjectBoardView
              project={selectedProject}
              tasks={allTasks.filter((t) => t.projectId === selectedProject.id && !t.isArchived)}
              externalEvents={externalEvents}
              completions={completions}
              onBack={() => setSelectedProjectId(null)}
              onEditTask={onEditTask}
              onAddTask={(columnId) =>
                onEditTask({
                  projectId: selectedProject.id,
                  projectStatus: columnId,
                  date: todayStr,
                } as any)
              }
              onChangeStatus={handleChangeStatus}
              onSelectExternalEvent={(evt) => setSelectedExternalEvent(evt)}
            />
          )
        ) : showAllProjectsBoard ? (
          <AllProjectsBoardView
            projects={projects}
            tasks={allTasks}
            externalEvents={externalEvents}
            completions={completions}
            onBack={() => setShowAllProjectsBoard(false)}
            onEditTask={onEditTask}
            onAddTask={(columnId) =>
              onEditTask({ projectStatus: columnId, date: todayStr } as any)
            }
            onChangeStatus={handleChangeStatus}
            onSelectExternalEvent={(evt) => setSelectedExternalEvent(evt)}
          />
        ) : (
          <ProjectsListView
            projects={projects}
            tasks={allTasks}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setShowAllProjectsBoard(false);
            }}
            onOpenAllProjectsBoard={() => setShowAllProjectsBoard(true)}
            onOpenNewProject={() => {
              setEditingProject(null);
              setIsProjectModalOpen(true);
            }}
            onEditProject={(project) => {
              setEditingProject(project);
              setIsProjectModalOpen(true);
            }}
            onEditTask={onEditTask}
          />
        )}
      </div>

      {/* DESKTOP VERSION: Splitted sidebar + Board layout (hidden on mobile) */}
      <div className="hidden md:flex md:flex-row md:flex-1 md:min-h-0 h-full w-full bg-[#0E0F12]">
        {/* Left projects sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-[#202228] bg-[#111214] flex flex-col p-4 min-h-0">
          <div className="flex items-center justify-between mb-4 px-1 flex-shrink-0">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#D4F63D]" />
              <span>Projets</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setIsProjectModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-bold text-xs transition-all cursor-pointer"
              title="Nouveau projet"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {/* Global option: All Projects */}
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                setShowAllProjectsBoard(true);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer text-left border",
                showAllProjectsBoard && !selectedProjectId
                  ? "bg-[#1E2027] border-[#383C48] text-white shadow-sm"
                  : "bg-transparent border-transparent text-[#8E929E] hover:text-white hover:bg-[#16171C]/50"
              )}
            >
              <LayoutGrid className="w-4 h-4 text-[#D4F63D]" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Tous les projets</div>
              </div>
            </button>

            {projects.length === 0 ? (
              <div className="p-6 text-center bg-[#1C1D22]/50 border border-[#282A30] rounded-2xl my-2">
                <p className="text-xs text-[#8E929E]">Aucun projet créé pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-1 pt-2 border-t border-[#202228]">
                {projects.map((project) => {
                  const projectTasks = tasksByProject(project.id);
                  const isSelected = selectedProjectId === project.id && !showAllProjectsBoard;

                  return (
                    <div
                      key={project.id}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-xl border transition-all",
                        isSelected
                          ? "bg-[#1E2027] border-[#383C48]"
                          : "bg-transparent border-transparent hover:bg-[#16171C]/35"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setShowAllProjectsBoard(false);
                        }}
                        className="flex-1 min-w-0 flex items-center gap-2.5 cursor-pointer text-left"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className={cn("text-sm truncate", isSelected ? "font-bold text-white" : "text-[#8E929E] hover:text-white")}>
                            {project.name}
                          </div>
                          <div className="text-[10px] text-[#6B7280]">
                            {projectTasks.length} tâche{projectTasks.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProject(project);
                          setIsProjectModalOpen(true);
                        }}
                        title="Modifier le projet"
                        className="p-1.5 rounded-lg text-[#8E929E] hover:text-[#D4F63D] hover:bg-[#282A30] transition-colors cursor-pointer flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right main board pane */}
        <div className="flex-1 min-w-0 h-full flex flex-col bg-[#0E0F12]">
          {selectedProjectId && selectedProject ? (
            <ProjectBoardView
              project={selectedProject}
              tasks={allTasks.filter((t) => t.projectId === selectedProject.id && !t.isArchived)}
              externalEvents={externalEvents}
              completions={completions}
              onBack={() => setSelectedProjectId(null)}
              onEditTask={onEditTask}
              onAddTask={(columnId) =>
                onEditTask({
                  projectId: selectedProject.id,
                  projectStatus: columnId,
                  date: todayStr,
                } as any)
              }
              onChangeStatus={handleChangeStatus}
              onSelectExternalEvent={(evt) => setSelectedExternalEvent(evt)}
            />
          ) : (
            <AllProjectsBoardView
              projects={projects}
              tasks={allTasks}
              externalEvents={externalEvents}
              completions={completions}
              onBack={() => {}}
              onEditTask={onEditTask}
              onAddTask={(columnId) =>
                onEditTask({ projectStatus: columnId, date: todayStr } as any)
              }
              onChangeStatus={handleChangeStatus}
              onSelectExternalEvent={(evt) => setSelectedExternalEvent(evt)}
            />
          )}
        </div>
      </div>

      <ProjectFormModal
        isOpen={isProjectModalOpen}
        initialProject={editingProject}
        onClose={closeProjectModal}
        onSubmit={(data, projectId) => {
          if (projectId) {
            updateProject.mutate({ projectId, updates: data });
          } else {
            createProject.mutate(data);
          }
        }}
      />

      {/* External Calendar Event Detail Modal */}
      <ExternalEventDetailModal
        event={selectedExternalEvent}
        onClose={() => setSelectedExternalEvent(null)}
      />
    </div>
  );
};
