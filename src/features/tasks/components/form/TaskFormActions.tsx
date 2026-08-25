"use client";

import React from "react";
import { Check, Plus } from "lucide-react";

interface TaskFormActionsProps {
  isEditing: boolean;
}

export const TaskFormActions: React.FC<TaskFormActionsProps> = ({
  isEditing,
}) => {
  if (isEditing) {
    return (
      <p className="w-full text-center text-[11px] text-[#8E929E] mt-5 flex items-center justify-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-[#D4F63D]" />
        Les modifications sont enregistrées automatiquement
      </p>
    );
  }

  return (
    <button
      type="submit"
      className="w-full py-4 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-[0.98] text-[#111214] font-bold text-base shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-5"
    >
      <Plus className="w-5 h-5 stroke-[3]" />
      Créer la tâche
    </button>
  );
};
