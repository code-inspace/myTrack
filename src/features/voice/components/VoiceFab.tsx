"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mic, Plus, MessageSquare } from "lucide-react";
import { VoiceActionModal } from "./VoiceActionModal";
import { useTaskMutations } from "@/features/tasks/hooks";
import { Task } from "@/features/tasks/types";
import { ParsedVoiceTask } from "../parser";
import { useProjects, useProjectMutations } from "@/features/projects/hooks";
import { DEFAULT_PROJECT_COLUMNS } from "@/features/projects/types";
import { useDisplayMode } from "@/providers/DisplayModeProvider";

interface VoiceFabProps {
  selectedDate: string;
  allTasks: Task[];
  onNewTask?: () => void;
}

export const VoiceFab: React.FC<VoiceFabProps> = ({ selectedDate, allTasks, onNewTask }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { createTask, closeTask } = useTaskMutations();
  const { projects } = useProjects();
  const { createProject } = useProjectMutations();
  const { displayMode } = useDisplayMode();

  const handleAddTasks = async (tasks: ParsedVoiceTask[]) => {
    const projectCache = new Map<string, string>();
    for (const p of projects || []) {
      projectCache.set(p.name.toLowerCase().trim(), p.id);
    }

    for (const task of tasks) {
      let resolvedProjectId: string | null | undefined = task.projectId;
      let resolvedProjectStatus: string | null | undefined = task.projectStatus;

      if (task.projectName && !resolvedProjectId) {
        const normName = task.projectName.toLowerCase().trim();
        if (projectCache.has(normName)) {
          resolvedProjectId = projectCache.get(normName);
        } else {
          try {
            const newProj = await createProject.mutateAsync({
              name: task.projectName,
              color: "#D4F63D",
              columns: DEFAULT_PROJECT_COLUMNS,
            });
            resolvedProjectId = newProj.id;
            projectCache.set(normName, newProj.id);
          } catch (err) {
            console.warn("Could not create project from voice intent:", err);
          }
        }
        resolvedProjectStatus = resolvedProjectStatus || "TODO";
      }

      createTask.mutate({
        title: task.title,
        description: task.description,
        tag: task.tag || task.category || "General",
        category: task.tag || task.category || "General",
        trackingType: task.trackingType || "BOOLEAN",
        recurrence: task.recurrence || "ONCE",
        recurrenceConfig: task.recurrenceConfig,
        startTime: task.startTime,
        endTime: task.endTime,
        targetValue: task.targetValue,
        unit: task.unit,
        enableReminders: task.enableReminders,
        reminderOffsetMinutes: task.reminderOffsetMinutes,
        date: task.targetDate,
        projectId: resolvedProjectId || null,
        projectStatus: resolvedProjectStatus || null,
      });
    }
  };

  const handleCompleteTasks = (taskIds: string[]) => {
    for (const taskId of taskIds) {
      closeTask.mutate({ taskId, date: selectedDate });
    }
  };

  return (
    <>
      {/* Floating Action Buttons: Coach IA (modern mode only), New Task (+), Voice AI (Mic) */}
      <div className="fixed bottom-24 right-4 sm:right-6 z-40 flex items-center gap-2.5">
        {/* 0. Coach IA — only shown in "modern" display mode, where it's no longer in the bottom nav */}
        {displayMode === "modern" && (
          <Link
            href="/chat"
            aria-label="Coach IA"
            title="Discuter avec le Coach IA"
            className="w-11 h-11 rounded-full bg-[#1C1D22] hover:bg-[#252830] active:scale-95 text-[#D4F63D] border border-[#2E323D] flex items-center justify-center shadow-xl transition-all duration-200 cursor-pointer hover:scale-105 group"
          >
            <MessageSquare className="w-5 h-5 stroke-[2.2] group-hover:scale-110 transition-transform" />
          </Link>
        )}

        {/* 1. Voice AI Command Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          aria-label="Ajout vocal d'actions"
          title="Parler pour ajouter une ou plusieurs actions"
          className="w-11 h-11 rounded-full bg-[#1C1D22] hover:bg-[#252830] active:scale-95 text-[#D4F63D] border border-[#2E323D] flex items-center justify-center shadow-xl transition-all duration-200 cursor-pointer hover:scale-105 group"
        >
          <Mic className="w-5 h-5 stroke-[2.2] group-hover:scale-110 transition-transform" />
        </button>

        {/* 2. New Task Button (+) */}
        {onNewTask && (
          <button
            type="button"
            onClick={onNewTask}
            aria-label="Nouvelle tâche"
            title="Créer une nouvelle tâche"
            className="w-13 h-13 rounded-full bg-[#D4F63D] hover:bg-[#c4e634] active:scale-95 text-[#111214] flex items-center justify-center shadow-2xl lime-glow-md transition-all duration-200 cursor-pointer border-2 border-white/20 hover:scale-105 group"
          >
            <Plus className="w-6 h-6 stroke-[2.8] group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Voice Action Modal */}
      <VoiceActionModal
        isOpen={isModalOpen}
        selectedDate={selectedDate}
        allTasks={allTasks}
        onClose={() => setIsModalOpen(false)}
        onAddTasks={handleAddTasks}
        onCompleteTasks={handleCompleteTasks}
      />
    </>
  );
};
