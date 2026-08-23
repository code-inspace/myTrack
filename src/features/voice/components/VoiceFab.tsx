"use client";

import React, { useState } from "react";
import { Mic } from "lucide-react";
import { VoiceActionModal } from "./VoiceActionModal";
import { useTaskMutations } from "@/features/tasks/hooks";
import { TaskFormValues } from "@/features/tasks/types";

interface VoiceFabProps {
  selectedDate: string;
}

export const VoiceFab: React.FC<VoiceFabProps> = ({ selectedDate }) => {
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
      {/* Floating Action Button with Glowing Mic Icon */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        aria-label="Ajout vocal d'actions"
        title="Parler pour ajouter une ou plusieurs actions"
        className="fixed bottom-20 right-4 z-40 w-13 h-13 rounded-full bg-[#D4F63D] hover:bg-[#c4e634] active:scale-95 text-[#111214] flex items-center justify-center shadow-2xl lime-glow-md transition-all duration-200 cursor-pointer border-2 border-white/20 hover:scale-105 group"
      >
        <Mic className="w-6 h-6 stroke-[2.4] group-hover:scale-110 transition-transform" />
      </button>

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
