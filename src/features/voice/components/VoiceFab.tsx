"use client";

import React, { useState } from "react";
import { Mic, Plus } from "lucide-react";
import { VoiceActionModal } from "./VoiceActionModal";
import { useTaskMutations } from "@/features/tasks/hooks";
import { TaskFormValues } from "@/features/tasks/types";

interface VoiceFabProps {
  selectedDate: string;
  onNewTask?: () => void;
}

export const VoiceFab: React.FC<VoiceFabProps> = ({ selectedDate, onNewTask }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { createTask } = useTaskMutations();

  const handleAddTasks = (tasks: (TaskFormValues & { targetDate?: string })[]) => {
    for (const task of tasks) {
      createTask.mutate({
        title: task.title,
        description: task.description,
        category: task.category || "General",
        trackingType: task.trackingType || "BOOLEAN",
        recurrence: task.recurrence || "ONCE",
        recurrenceConfig: task.recurrenceConfig,
        startTime: task.startTime,
        endTime: task.endTime,
        targetValue: task.targetValue,
        unit: task.unit,
      });
    }
  };

  return (
    <>
      {/* Dual Floating Action Buttons: New Task (+) and Voice AI (Mic) */}
      <div className="fixed bottom-24 right-4 sm:right-6 z-40 flex items-center gap-2.5">
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
        onClose={() => setIsModalOpen(false)}
        onAddTasks={handleAddTasks}
      />
    </>
  );
};
