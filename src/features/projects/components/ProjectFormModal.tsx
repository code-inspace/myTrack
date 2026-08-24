"use client";

import React, { useState } from "react";
import { X, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string) => void;
}

const COLOR_OPTIONS = ["#D4F63D", "#34D399", "#60A5FA", "#F472B6", "#A78BFA", "#F59E0B"];

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), color);
    setName("");
    setColor(COLOR_OPTIONS[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-2xl relative space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#282A30]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-[#D4F63D]" />
            <span>Nouveau projet</span>
          </h2>
          <button
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#252830] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
              Nom du projet *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="ex: Refonte site web"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] text-white text-sm outline-none transition-all placeholder-[#6B7280]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
              Couleur
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all cursor-pointer",
                    color === c ? "ring-2 ring-offset-2 ring-offset-[#1C1D22] ring-white scale-110" : ""
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-sm transition-all cursor-pointer"
          >
            Créer le projet
          </button>
        </form>
      </div>
    </div>
  );
};
