"use client";

import React, { useState } from "react";
import { Task } from "@/features/tasks/types";
import { useTaskMutations } from "@/features/tasks/hooks";
import { useProjects, useProjectMutations } from "../hooks";
import { Project } from "../types";
import { ProjectsListView } from "./ProjectsListView";
import { ProjectBoardView } from "./ProjectBoardView";
import { ProjectFormModal } from "./ProjectFormModal";

interface ProjectsViewProps {
  allTasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTaskToColumn: (projectId: string, projectStatus: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ allTasks, onEditTask, onAddTaskToColumn }) => {
  const { projects } = useProjects();
  const { createProject, updateProject } = useProjectMutations();
  const { updateTask } = useTaskMutations();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const closeProjectModal = () => {
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  if (selectedProject) {
    return (
      <ProjectBoardView
        project={selectedProject}
        tasks={allTasks.filter((t) => t.projectId === selectedProject.id && !t.isArchived)}
        onBack={() => setSelectedProjectId(null)}
        onEditTask={onEditTask}
        onChangeStatus={(taskId, status) =>
          updateTask.mutate({ taskId, values: { projectStatus: status } })
        }
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
