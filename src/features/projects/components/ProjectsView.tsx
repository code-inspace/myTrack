"use client";

import React, { useState } from "react";
import { Task } from "@/features/tasks/types";
import { useTaskMutations } from "@/features/tasks/hooks";
import { useProjects, useProjectMutations } from "../hooks";
import { ProjectStatus } from "../types";
import { ProjectsListView } from "./ProjectsListView";
import { ProjectBoardView } from "./ProjectBoardView";
import { ProjectFormModal } from "./ProjectFormModal";

interface ProjectsViewProps {
  allTasks: Task[];
  onEditTask: (task: Task) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ allTasks, onEditTask }) => {
  const { projects } = useProjects();
  const { createProject } = useProjectMutations();
  const { updateTask } = useTaskMutations();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  if (selectedProject) {
    return (
      <ProjectBoardView
        project={selectedProject}
        tasks={allTasks.filter((t) => t.projectId === selectedProject.id && !t.isArchived)}
        onBack={() => setSelectedProjectId(null)}
        onEditTask={onEditTask}
        onChangeStatus={(taskId, status: ProjectStatus) =>
          updateTask.mutate({ taskId, values: { projectStatus: status } })
        }
      />
    );
  }

  return (
    <>
      <ProjectsListView
        projects={projects}
        tasks={allTasks}
        onSelectProject={setSelectedProjectId}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onEditTask={onEditTask}
      />
      <ProjectFormModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onSubmit={(name, color) => createProject.mutate({ name, color })}
      />
    </>
  );
};
