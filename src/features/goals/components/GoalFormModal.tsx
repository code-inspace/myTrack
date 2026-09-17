"use client";

import React, { useEffect, useState } from "react";
import { X, Target, Clock, Calendar, Folder, Tag, Trash2, Check, Sparkles, Info } from "lucide-react";
import { Goal, GoalPeriodType, getGoalPeriodKey, getGoalPeriodHumanLabel } from "../types";
import { Project } from "@/features/projects/types";
import { Period } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

interface GoalFormModalProps {
  isOpen: boolean;
  initialGoal?: Goal | null;
  projects: Project[];
  referenceDate?: Date;
  currentPeriod?: Period;
  onClose: () => void;
  onSubmit: (goalData: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">, goalId?: string) => Promise<void> | void;
  onDelete?: (goalId: string) => Promise<void> | void;
}

const PRESET_HOURS = [1, 2, 3, 5, 8, 10, 15, 20];

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  isOpen,
  initialGoal,
  projects,
  referenceDate = new Date(),
  currentPeriod = "week",
  onClose,
  onSubmit,
  onDelete,
}) => {
  const [projectId, setProjectId] = useState<string>("");
  const [projectCategory, setProjectCategory] = useState<string>("");
  
  const initialType: GoalPeriodType =
    currentPeriod === "day" ? "day" : currentPeriod === "month" ? "month" : "week";
  const [periodType, setPeriodType] = useState<GoalPeriodType>(initialType);
  const [hours, setHours] = useState<number>(3);
  const [minutes, setMinutes] = useState<number>(0);
  const [title, setTitle] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isEditing = Boolean(initialGoal);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    setShowConfirmDelete(false);

    if (initialGoal) {
      setProjectId(initialGoal.projectId || (projects[0]?.id ?? ""));
      setProjectCategory(initialGoal.projectCategory || "");
      setPeriodType(initialGoal.periodType || "week");
      const totalMins = initialGoal.targetMinutes || 180;
      setHours(Math.floor(totalMins / 60));
      setMinutes(totalMins % 60);
      setTitle(initialGoal.title || "");
    } else {
      setProjectId(projects[0]?.id ?? "");
      setProjectCategory("");
      const resolvedType: GoalPeriodType =
        currentPeriod === "day" ? "day" : currentPeriod === "month" ? "month" : "week";
      setPeriodType(resolvedType);
      setHours(resolvedType === "day" ? 2 : resolvedType === "week" ? 5 : 20);
      setMinutes(0);
      setTitle("");
    }
  }, [isOpen, initialGoal, projects, currentPeriod]);

  if (!isOpen) return null;

  const selectedProject = projects.find((p) => p.id === projectId);
  const availableCategories = selectedProject?.categories || [];

  const periodLabel = getGoalPeriodHumanLabel(periodType, referenceDate);
  const periodKey = getGoalPeriodKey(periodType, referenceDate);

  const handlePresetSelect = (presetHours: number) => {
    setHours(presetHours);
    setMinutes(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    const totalMinutes = Math.max(1, hours * 60 + minutes);
    setIsSubmitting(true);

    try {
      await onSubmit(
        {
          projectId,
          projectCategory: projectCategory.trim() ? projectCategory.trim() : undefined,
          periodType,
          periodKey: initialGoal?.periodKey || periodKey,
          targetMinutes: totalMinutes,
          title: title.trim() ? title.trim() : undefined,
          color: selectedProject?.color || "#D4F63D",
        },
        initialGoal?.id
      );
      onClose();
    } catch (err) {
      console.error("Error submitting goal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialGoal?.id || !onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete(initialGoal.id);
      onClose();
    } catch (err) {
      console.error("Error deleting goal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-[#141519] border border-[#23252E] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#23252E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4F63D]/10 text-[#D4F63D] flex items-center justify-center border border-[#D4F63D]/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isEditing ? "Modifier l'objectif" : "Nouvel objectif"}
              </h2>
              <p className="text-xs text-[#8E929E]">
                Définissez un temps cible pour un projet ou sous-projet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#1C1D24] text-[#8E929E] hover:text-white hover:bg-[#252832] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. Projet Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8E929E] mb-2 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              <span>Projet concerné *</span>
            </label>
            {projects.length === 0 ? (
              <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 p-3 rounded-xl border border-[#EF4444]/20">
                Aucun projet disponible. Veuillez créer un projet d'abord.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {projects.map((p) => {
                  const isSelected = p.id === projectId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProjectId(p.id);
                        // Reset category if not in new project
                        if (projectCategory && !p.categories?.includes(projectCategory)) {
                          setProjectCategory("");
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-2xl border text-left text-xs font-semibold transition-all cursor-pointer truncate",
                        isSelected
                          ? "bg-[#1F222C] border-white/30 text-white shadow-sm"
                          : "bg-[#181920] border-[#252832] text-[#8E929E] hover:text-white hover:border-[#353948]"
                      )}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color || "#D4F63D" }}
                      />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Sous-projet / Catégorie Selector */}
          {selectedProject && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8E929E] mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Sous-projet / Catégorie (optionnel)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setProjectCategory("")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                    projectCategory === ""
                      ? "bg-[#D4F63D]/20 border-[#D4F63D] text-[#D4F63D]"
                      : "bg-[#181920] border-[#252832] text-[#8E929E] hover:text-white hover:border-[#353948]"
                  )}
                >
                  Tout le projet
                </button>
                {availableCategories.map((cat) => {
                  const isCatSelected = projectCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setProjectCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                        isCatSelected
                          ? "bg-[#D4F63D]/20 border-[#D4F63D] text-[#D4F63D]"
                          : "bg-[#181920] border-[#252832] text-[#8E929E] hover:text-white hover:border-[#353948]"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Période Ciblée (Jour / Semaine / Mois) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8E929E] mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Période ciblée *</span>
            </label>
            <div className="grid grid-cols-3 gap-2 bg-[#101114] p-1 rounded-2xl border border-[#23252E]">
              {(
                [
                  { id: "day", label: "Jour" },
                  { id: "week", label: "Semaine" },
                  { id: "month", label: "Mois" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodType(p.id)}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    periodType === p.id
                      ? "bg-[#252834] text-white shadow-sm border border-white/10"
                      : "text-[#8E929E] hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Période précise & indication de non-récurrence */}
            <div className="mt-2.5 p-3 rounded-2xl bg-[#181A22] border border-[#262936] flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#D4F63D] shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {periodLabel}
                </p>
                <p className="text-[11px] text-[#8E929E] leading-relaxed">
                  Objectif unique lié à cette période (non-récurrent).
                </p>
              </div>
            </div>
          </div>

          {/* 4. Durée Cible */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8E929E] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Objectif de temps *</span>
              </span>
              <span className="text-[#D4F63D] font-bold lowercase">
                {hours}h {minutes > 0 ? `${minutes}m` : ""} pour {periodType === "day" ? "ce jour" : periodType === "week" ? "cette semaine" : "ce mois"}
              </span>
            </label>

            {/* Presets rapides */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_HOURS.map((pH) => (
                <button
                  key={pH}
                  type="button"
                  onClick={() => handlePresetSelect(pH)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    hours === pH && minutes === 0
                      ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold"
                      : "bg-[#181920] border-[#252832] text-[#8E929E] hover:text-white"
                  )}
                >
                  {pH}h
                </button>
              ))}
            </div>

            {/* Inputs précis heures et minutes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-[#8E929E] block mb-1">Heures</span>
                <input
                  type="number"
                  min="0"
                  max="168"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#181920] border border-[#252832] focus:border-[#D4F63D] focus:outline-none rounded-xl px-3 py-2 text-white font-bold text-sm"
                />
              </div>
              <div>
                <span className="text-[11px] text-[#8E929E] block mb-1">Minutes</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="5"
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
                  }
                  className="w-full bg-[#181920] border border-[#252832] focus:border-[#D4F63D] focus:outline-none rounded-xl px-3 py-2 text-white font-bold text-sm"
                />
              </div>
            </div>
          </div>

          {/* 5. Titre Optionnel */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8E929E] mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nom personnalisé (optionnel)</span>
            </label>
            <input
              type="text"
              placeholder={
                selectedProject
                  ? `Ex: ${selectedProject.name}${projectCategory ? ` - ${projectCategory}` : ""}`
                  : "Ex: Session Deep Work"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#181920] border border-[#252832] focus:border-[#D4F63D] focus:outline-none rounded-xl px-3 py-2 text-white text-sm"
            />
          </div>

          {/* Delete confirmation if editing */}
          {isEditing && (
            <div className="pt-2 border-t border-[#23252E]">
              {showConfirmDelete ? (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#EF4444] font-semibold">
                    Confirmer la suppression ?
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(false)}
                      className="px-2.5 py-1 text-xs bg-[#1C1D24] text-[#8E929E] hover:text-white rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 text-xs bg-[#EF4444] text-white font-bold rounded-lg cursor-pointer"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-xs text-[#EF4444] hover:text-[#FF6B6B] flex items-center gap-1.5 font-semibold cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer cet objectif</span>
                </button>
              )}
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#23252E]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#1C1D24] hover:bg-[#252832] text-xs font-semibold text-[#8E929E] hover:text-white transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !projectId || (hours === 0 && minutes === 0)}
              className="px-5 py-2.5 rounded-xl bg-[#D4F63D] hover:bg-[#bce028] disabled:opacity-50 text-black text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? "Enregistrer" : "Créer l'objectif"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
