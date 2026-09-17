"use client";

import React, { useEffect, useState } from "react";
import { X, Target, Clock, Calendar, Folder, Tag, Trash2, Check, Sparkles, Hash, Repeat } from "lucide-react";
import { Goal, GoalPeriodType, GoalTargetType, getGoalPeriodKey, getGoalPeriodHumanLabel } from "../types";
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
const PRESET_COUNTS = [1, 2, 3, 4, 5, 6, 7, 10];

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
  const [projectCategories, setProjectCategories] = useState<string[]>([]);
  
  const initialType: GoalPeriodType =
    currentPeriod === "day" ? "day" : currentPeriod === "month" ? "month" : "week";
  const [periodType, setPeriodType] = useState<GoalPeriodType>(initialType);
  const [targetType, setTargetType] = useState<GoalTargetType>("duration");
  const [hours, setHours] = useState<number>(3);
  const [minutes, setMinutes] = useState<number>(0);
  const [targetCount, setTargetCount] = useState<number>(2);
  const [unit, setUnit] = useState<string>("séance");
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
      const initCats =
        Array.isArray(initialGoal.projectCategories) && initialGoal.projectCategories.length > 0
          ? initialGoal.projectCategories
          : initialGoal.projectCategory
          ? [initialGoal.projectCategory]
          : [];
      setProjectCategories(initCats);
      setPeriodType(initialGoal.periodType || "week");
      setTargetType(initialGoal.targetType || "duration");
      const totalMins = initialGoal.targetMinutes || 180;
      setHours(Math.floor(totalMins / 60));
      setMinutes(totalMins % 60);
      setTargetCount(initialGoal.targetCount || 2);
      setUnit(initialGoal.unit || "séance");
      setTitle(initialGoal.title || "");
    } else {
      setProjectId(projects[0]?.id ?? "");
      setProjectCategories([]);
      const resolvedType: GoalPeriodType =
        currentPeriod === "day" ? "day" : currentPeriod === "month" ? "month" : "week";
      setPeriodType(resolvedType);
      setTargetType("duration");
      setHours(resolvedType === "day" ? 2 : resolvedType === "week" ? 5 : 20);
      setMinutes(0);
      setTargetCount(resolvedType === "day" ? 1 : resolvedType === "week" ? 2 : 8);
      setUnit("séance");
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

  const handleToggleCategory = (cat: string) => {
    setProjectCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
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
          projectCategory: projectCategories.length === 1 ? projectCategories[0] : undefined,
          projectCategories: projectCategories.length > 0 ? projectCategories : undefined,
          periodType,
          periodKey: initialGoal?.periodKey || periodKey,
          targetType,
          targetMinutes: targetType === "duration" ? totalMinutes : 0,
          targetCount: targetType === "count" ? Math.max(1, targetCount) : undefined,
          unit: targetType === "count" ? (unit.trim() || "séance") : undefined,
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
                        // Filter categories to only keep those that exist in new project
                        if (projectCategories.length > 0) {
                          setProjectCategories((prev) =>
                            prev.filter((c) => p.categories?.includes(c))
                          );
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

          {/* 2. Sous-projet / Catégorie Selector (Multi-sélection possible) */}
          {selectedProject && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#8E929E] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Sous-projets / Catégories</span>
                </label>
                {projectCategories.length > 1 && (
                  <span className="text-[11px] font-bold text-[#D4F63D] bg-[#D4F63D]/10 px-2 py-0.5 rounded-full border border-[#D4F63D]/20">
                    {projectCategories.length} sous-projets sélectionnés
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setProjectCategories([])}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                    projectCategories.length === 0
                      ? "bg-[#D4F63D]/20 border-[#D4F63D] text-[#D4F63D]"
                      : "bg-[#181920] border-[#252832] text-[#8E929E] hover:text-white hover:border-[#353948]"
                  )}
                >
                  {projectCategories.length === 0 && <Check className="w-3.5 h-3.5" />}
                  <span>Tout le projet</span>
                </button>
                {availableCategories.map((cat) => {
                  const isCatSelected = projectCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                        isCatSelected
                          ? "bg-[#D4F63D]/20 border-[#D4F63D] text-[#D4F63D]"
                          : "bg-[#181920] border-[#252832] text-[#8E929E] hover:text-white hover:border-[#353948]"
                      )}
                    >
                      {isCatSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#8E929E] mt-1.5">
                Vous pouvez sélectionner plusieurs sous-projets à agréger dans cet objectif.
              </p>
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

          {/* 4. Type de Cible: Temps vs Nombre de fois */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8E929E] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                <span>Objectif cible *</span>
              </span>
              <span className="text-[#D4F63D] font-bold lowercase">
                {targetType === "duration"
                  ? `${hours}h ${minutes > 0 ? `${minutes}m` : ""} ${periodType === "day" ? "ce jour" : periodType === "week" ? "cette semaine" : "ce mois"}`
                  : `${targetCount} ${targetCount > 1 ? (unit === "fois" ? "fois" : "séances") : (unit === "fois" ? "fois" : "séance")} ${periodType === "day" ? "ce jour" : periodType === "week" ? "cette semaine" : "ce mois"}`}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2 bg-[#101114] p-1 rounded-2xl border border-[#23252E] mb-3">
              <button
                type="button"
                onClick={() => setTargetType("duration")}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  targetType === "duration"
                    ? "bg-[#252834] text-white shadow-sm border border-white/10"
                    : "text-[#8E929E] hover:text-white"
                )}
              >
                <Clock className="w-4 h-4 text-[#D4F63D]" />
                <span>En temps (durée)</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("count")}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  targetType === "count"
                    ? "bg-[#252834] text-white shadow-sm border border-white/10"
                    : "text-[#8E929E] hover:text-white"
                )}
              >
                <Hash className="w-4 h-4 text-[#818CF8]" />
                <span>Nombre de fois (séances)</span>
              </button>
            </div>

            {targetType === "duration" ? (
              <div className="space-y-3 animate-in fade-in duration-150">
                {/* Presets rapides d'heures */}
                <div className="flex flex-wrap gap-1.5">
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
            ) : (
              <div className="space-y-3 animate-in fade-in duration-150">
                {/* Presets rapides de nombre de fois */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COUNTS.map((pC) => (
                    <button
                      key={pC}
                      type="button"
                      onClick={() => setTargetCount(pC)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                        targetCount === pC
                          ? "bg-[#818CF8] text-white border-[#818CF8] font-bold shadow-sm"
                          : "bg-[#181920] border-[#252832] text-[#8E929E] hover:text-white"
                      )}
                    >
                      {pC} {pC > 1 ? "fois" : "fois"}
                    </button>
                  ))}
                </div>

                {/* Input nombre de fois & Libellé unité */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-[#8E929E] block mb-1">Nombre de séances / fois</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTargetCount((c) => Math.max(1, c - 1))}
                        className="w-9 h-9 rounded-xl bg-[#181920] border border-[#252832] hover:bg-[#252834] text-white font-bold text-base flex items-center justify-center cursor-pointer shrink-0"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={targetCount}
                        onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 bg-[#181920] border border-[#252832] focus:border-[#818CF8] focus:outline-none rounded-xl px-3 py-2 text-white font-bold text-sm text-center"
                      />
                      <button
                        type="button"
                        onClick={() => setTargetCount((c) => c + 1)}
                        className="w-9 h-9 rounded-xl bg-[#181920] border border-[#252832] hover:bg-[#252834] text-white font-bold text-base flex items-center justify-center cursor-pointer shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#8E929E] block mb-1">Unité (ex: séance, fois)</span>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="séance, fois, session..."
                      className="w-full bg-[#181920] border border-[#252832] focus:border-[#818CF8] focus:outline-none rounded-xl px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
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
                  ? `Ex: ${selectedProject.name}${projectCategories.length > 0 ? ` - ${projectCategories.join(", ")}` : ""}`
                  : "Ex: 2 séances de sport"
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
              disabled={
                isSubmitting ||
                !projectId ||
                (targetType === "duration" && hours === 0 && minutes === 0) ||
                (targetType === "count" && targetCount <= 0)
              }
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
