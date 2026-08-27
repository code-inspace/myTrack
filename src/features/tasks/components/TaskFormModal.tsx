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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1C1D22] border border-[#282A30] rounded-t-3xl sm:rounded-3xl shadow-2xl relative max-h-[70dvh] sm:max-h-[78vh] flex flex-col overflow-hidden my-0 sm:my-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200">
        {/* Fixed Header */}
        <div className="p-4 pb-3 border-b border-[#282A30] flex-shrink-0 bg-[#1C1D22]">
          <TaskFormHeader
            isEditing={form.isEditing}
            onClose={form.isEditing ? form.handleCloseWhileEditing : onClose}
          />
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={form.handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 overscroll-contain touch-pan-y">
            {/* Section 1: Informations générales, Date, Priorité, Catégorie, Suivi & Projet */}
            <TaskFormGeneralSection form={form} />

            {/* Section 2: Récurrence, Horaire & Notifications/Rappels */}
            <TaskFormScheduleSection form={form} />
          </div>

          {/* Sticky Submit Action Button */}
          <div className="p-3.5 sm:p-4 pt-2.5 border-t border-[#282A30] bg-[#1C1D22] flex-shrink-0">
            <TaskFormActions isEditing={form.isEditing} />
          </div>
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
