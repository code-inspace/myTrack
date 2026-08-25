"use client";

import React from "react";
import { Edit3, Plus, X } from "lucide-react";

interface TaskFormHeaderProps {
  isEditing: boolean;
  onClose: () => void;
}

export const TaskFormHeader: React.FC<TaskFormHeaderProps> = ({
  isEditing,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-[#282A30]">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          {isEditing ? (
            <>
              <Edit3 className="w-5 h-5 text-[#D4F63D]" />
              <span>Modifier la tâche</span>
            </>
          ) : (
            <>
              <Plus className="w-5 h-5 text-[#D4F63D]" />
              <span>Créer une nouvelle tâche</span>
            </>
          )}
        </h2>
        <p className="text-xs text-[#8E929E] mt-0.5">
          {isEditing
            ? "Modifie les paramètres"
            : "Définis ton habitude ou ton action"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#252830] transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
