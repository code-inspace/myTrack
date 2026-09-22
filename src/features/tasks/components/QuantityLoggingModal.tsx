"use client";

import React, { useState } from "react";
import { TaskWithCompletion } from "../types";
import { X, Plus, Minus, Check } from "lucide-react";

interface QuantityLoggingModalProps {
  task: TaskWithCompletion | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveValue: (taskId: string, value: number) => void;
}

export const QuantityLoggingModal: React.FC<QuantityLoggingModalProps> = ({
  task,
  isOpen,
  onClose,
  onSaveValue,
}) => {
  if (!isOpen || !task) return null;

  const [val, setVal] = useState<number>(task.currentValue || 0);

  const handleIncrement = (amount: number) => {
    setVal((prev) => Math.max(0, prev + amount));
  };

  const handleSave = () => {
    onSaveValue(task.id, val);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="modal-adaptive-card w-full max-w-sm max-h-[90vh] overflow-y-auto overscroll-contain bg-[#1C1D22] border border-[#282A30] rounded-3xl p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#8E929E] hover:text-white p-1 rounded-full bg-[#252830]"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">
          {task.title}
        </h3>
        <p className="text-xs text-[#8E929E] mb-6">
          Enregistre ta progression d'aujourd'hui
          {task.targetValue ? ` (Objectif : ${task.targetValue} ${task.unit || ""})` : ""}
        </p>

        {/* Big number counter */}
        <div className="flex items-center justify-center gap-4 my-6">
          <button
            onClick={() => handleIncrement(-5)}
            className="w-11 h-11 rounded-full bg-[#252830] hover:bg-[#343740] active:scale-95 text-white flex items-center justify-center transition-all"
          >
            <Minus className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center">
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-28 text-center text-4xl font-extrabold bg-transparent text-[#D4F63D] border-b border-[#343740] focus:border-[#D4F63D] focus:outline-none pb-1"
            />
            <span className="text-xs font-semibold text-[#8E929E] mt-1 uppercase tracking-wider">
              {task.unit || "Unités"}
            </span>
          </div>

          <button
            onClick={() => handleIncrement(5)}
            className="w-11 h-11 rounded-full bg-[#252830] hover:bg-[#343740] active:scale-95 text-white flex items-center justify-center transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[1, 5, 10, 25].map((preset) => (
            <button
              key={preset}
              onClick={() => handleIncrement(preset)}
              className="py-1.5 rounded-xl bg-[#252830] hover:bg-[#343740] text-xs font-semibold text-[#D1D5DB] transition-all"
            >
              +{preset}
            </button>
          ))}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3.5 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-[0.98] text-[#111214] font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          Valider la progression
        </button>
      </div>
    </div>
  );
};
