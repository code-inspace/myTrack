"use client";

import React, { useState } from "react";
import { Task } from "@/features/tasks/types";
import { useTaskMutations } from "@/features/tasks/hooks";
import { getTodayDateString } from "@/lib/dates";
import { useProjects, useProjectMutations } from "../hooks";
import { Project } from "../types";
import { ProjectsListView } from "./ProjectsListView";
import { ProjectBoardView } from "./ProjectBoardView";
import { AllProjectsBoardView } from "./AllProjectsBoardView";
import { ProjectFormModal } from "./ProjectFormModal";

interface ProjectsViewProps {
  allTasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTaskToColumn: (projectId: string, projectStatus: string) => void;
  onNewTask: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ allTasks, onEditTask, onAddTaskToColumn, onNewTask }) => {
  const { projects } = useProjects();
  const { createProject, updateProject } = useProjectMutations();
  const { updateTask, closeTask } = useTaskMutations();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAllProjectsBoard, setShowAllProjectsBoard] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const closeProjectModal = () => {
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleChangeStatus = (taskId: string, status: string, isDoneColumn: boolean) => {
    updateTask.mutate({ taskId, values: { projectStatus: status } });
    if (isDoneColumn) {
      closeTask.mutate({ taskId, date: getTodayDateString() });
    }
  };

  if (showAllProjectsBoard) {
    return (
      <AllProjectsBoardView
        projects={projects}
        tasks={allTasks}
        onBack={() => setShowAllProjectsBoard(false)}
        onEditTask={onEditTask}
        onChangeStatus={handleChangeStatus}
        onAddTask={onNewTask}
      />
    );
  }

  if (selectedProject) {
    return (
      <ProjectBoardView
        project={selectedProject}
        tasks={allTasks.filter((t) => t.projectId === selectedProject.id && !t.isArchived)}
        onBack={() => setSelectedProjectId(null)}
        onEditTask={onEditTask}
        onChangeStatus={handleChangeStatus}
        onAddTask={onAddTaskToColumn}
      />
    );
  }

  return (
    <>
      <ProjectsListView
        projects={projects}
        tasks={allTasks}
        onSelectProject={setSelectedProjectId}
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
    </>
  );
};
