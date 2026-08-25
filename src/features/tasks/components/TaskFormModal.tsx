"use client";

import React from "react";
import { Task, TaskFormValues, TaskWithCompletion } from "../types";
import { useProjectMutations } from "@/features/projects/hooks";
import { getProjectColumns } from "@/features/projects/types";
import { ProjectFormModal } from "@/features/projects/components/ProjectFormModal";
import { useTaskForm } from "./useTaskForm";
import {
  TaskFormHeader,
  TaskFormGeneralSection,
  TaskFormScheduleSection,
  TaskFormActions,
} from "./form";

interface TaskFormModalProps {
  isOpen: boolean;
  initialTask?: Task | TaskWithCompletion | null;
  onClose: () => void;
  onSubmit: (values: TaskFormValues, taskId?: string) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  initialTask,
  onClose,
  onSubmit,
}) => {
  const form = useTaskForm({
    isOpen,
    initialTask,
    onSubmit,
    onClose,
  });

  const { createProject } = useProjectMutations();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto my-auto space-y-4">
        {/* Header */}
        <TaskFormHeader
          isEditing={form.isEditing}
          onClose={form.isEditing ? form.handleCloseWhileEditing : onClose}
        />

        <form onSubmit={form.handleSubmit} className="space-y-2.5">
          {/* Section 1: Informations générales, Date, Priorité, Catégorie, Suivi & Projet */}
          <TaskFormGeneralSection form={form} />

          {/* Section 2: Récurrence, Horaire & Notifications/Rappels */}
          <TaskFormScheduleSection form={form} />

          {/* Submit Action Button or Auto-Save Notice */}
          <TaskFormActions isEditing={form.isEditing} />
        </form>
      </div>

      <ProjectFormModal
        isOpen={form.isNewProjectOpen}
        onClose={() => form.setIsNewProjectOpen(false)}
        onSubmit={(data) => {
          createProject.mutate(data, {
            onSuccess: (newProject) => {
              form.setProjectId(newProject.id);
              form.setProjectStatus(getProjectColumns(newProject)[0].id);
            },
          });
        }}
      />
    </div>
  );
};
