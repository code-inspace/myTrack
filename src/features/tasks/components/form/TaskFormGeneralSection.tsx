"use client";

import React from "react";
import {
  CalendarDays,
  Flag,
  X,
  Flame,
  Tag,
  Sliders,
  FolderKanban,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskFormState } from "../useTaskForm";
import {
  PRIORITY_OPTIONS,
  getPriorityIconColorClass,
} from "@/features/tasks/priority";
import { TASK_CATEGORIES, TRACKING_TYPE_OPTIONS } from "@/features/tasks/options";
import { useProjects } from "@/features/projects/hooks";
import { getProjectColumns } from "@/features/projects/types";

interface TaskFormGeneralSectionProps {
  form: TaskFormState;
}

export const TaskFormGeneralSection: React.FC<TaskFormGeneralSectionProps> = ({
  form,
}) => {
  const { projects } = useProjects();
  const currentCategoryObj =
    TASK_CATEGORIES.find((c) => c.id === form.category) || TASK_CATEGORIES[0];
  const currentTrackingObj =
    TRACKING_TYPE_OPTIONS.find((t) => t.id === form.trackingType) ||
    TRACKING_TYPE_OPTIONS[0];

  return (
    <div className="space-y-2.5">
      {/* Task Name */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
          Nom de la tâche *
        </label>
        <input
          type="text"
          required
          placeholder="ex: Pompes, Lire 20 pages, Deep work..."
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] text-white text-sm outline-none transition-all placeholder-[#6B7280]"
        />
      </div>

      {/* Description */}
      <div>
        <input
          type="text"
          placeholder="Description ou notes (optionnel)"
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#252830]/60 border border-[#343740] focus:border-[#D4F63D] text-xs text-white outline-none transition-all placeholder-[#6B7280]"
        />
      </div>

      {/* Date */}
      <div className="p-3 rounded-2xl bg-[#22242B] border border-[#2F323E] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-4 h-4 text-[#D4F63D]" />
          <div>
            <div className="text-xs font-bold text-white">Date de la tâche</div>
            <div className="text-[10px] text-[#8E929E]">
              Jour d'exécution ou départ
            </div>
          </div>
        </div>
        <input
          type="date"
          value={form.targetDate}
          onChange={(e) => form.setTargetDate(e.target.value)}
          className="h-9 px-3 rounded-xl bg-[#252830] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none text-center cursor-pointer"
        />
      </div>

      {/* Deadline */}
      <div className="p-3 rounded-2xl bg-[#22242B] border border-[#2F323E] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Flag className="w-4 h-4 text-[#D4F63D]" />
          <div>
            <div className="text-xs font-bold text-white">Deadline</div>
            <div className="text-[10px] text-[#8E929E]">
              Optionnel — date limite
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => form.setDeadline(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#252830] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none text-center cursor-pointer"
          />
          {form.deadline && (
            <button
              type="button"
              onClick={() => form.setDeadline("")}
              title="Retirer la deadline"
              className="p-1.5 rounded-lg text-[#8E929E] hover:text-red-400 hover:bg-[#252830] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Accordion: Priorité */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => form.toggleSection("priority")}
          className="w-full p-2.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-[#D4F63D]" />
            <span className="text-xs font-bold text-white">Priorité</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
              {PRIORITY_OPTIONS.find((o) => o.id === form.priority)?.label}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                form.expandedSections.priority ? "rotate-180 text-white" : "",
              )}
            />
          </div>
        </button>

        {form.expandedSections.priority && (
          <div className="p-2.5 pt-1 border-t border-[#2B2E39] grid grid-cols-3 gap-2 animate-in fade-in duration-150">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => {
                  form.setPriority(opt.id);
                  form.toggleSection("priority");
                }}
                className={cn(
                  "px-2 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  form.priority === opt.id
                    ? opt.id === "VERY_URGENT"
                      ? "bg-red-500/15 border-red-500 text-red-400 font-extrabold"
                      : opt.id === "URGENT"
                        ? "bg-amber-500/15 border-amber-500 text-amber-400 font-bold"
                        : "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D]"
                    : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]",
                )}
              >
                {opt.id !== "NORMAL" && (
                  <Flame
                    className={cn("w-3 h-3", getPriorityIconColorClass(opt.id))}
                  />
                )}
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Accordion: Catégorie */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => form.toggleSection("category")}
          className="w-full p-2.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Tag className="w-4 h-4 text-[#D4F63D]" />
            <span className="text-xs font-bold text-white">Catégorie</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
              {currentCategoryObj.label.split(" ")[0]}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                form.expandedSections.category ? "rotate-180 text-white" : "",
              )}
            />
          </div>
        </button>

        {form.expandedSections.category && (
          <div className="p-2.5 pt-1 border-t border-[#2B2E39] grid grid-cols-3 gap-2 animate-in fade-in duration-150">
            {TASK_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => {
                  form.setCategory(cat.id);
                  form.toggleSection("category");
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all text-center truncate cursor-pointer",
                  form.category === cat.id
                    ? "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D]"
                    : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]",
                )}
              >
                {cat.label.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Accordion: Type de suivi */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => form.toggleSection("tracking")}
          className="w-full p-2.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[#D4F63D]" />
            <span className="text-xs font-bold text-white">Type de suivi</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
              {form.trackingType === "BOOLEAN"
                ? "Oui / Non"
                : `${form.targetValue ?? ""} ${form.unit || currentTrackingObj.defaultUnit || ""}`}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                form.expandedSections.tracking ? "rotate-180 text-white" : "",
              )}
            />
          </div>
        </button>

        {form.expandedSections.tracking && (
          <div className="p-2.5 pt-1.5 border-t border-[#2B2E39] space-y-2.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2">
              {TRACKING_TYPE_OPTIONS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => {
                    form.setTrackingType(t.id as any);
                    if (t.defaultUnit && !form.unit) form.setUnit(t.defaultUnit);
                    if (t.id === "NUMBER" && !form.targetValue) form.setTargetValue(50);
                    if (t.id === "DURATION" && !form.targetValue) form.setTargetValue(30);
                  }}
                  className={cn(
                    "p-2.5 rounded-2xl border text-left transition-all cursor-pointer",
                    form.trackingType === t.id
                      ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                      : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]",
                  )}
                >
                  <div className="text-xs font-bold text-white">{t.label}</div>
                  <div className="text-[11px] text-[#8E929E] mt-0.5">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>

            {form.trackingType !== "BOOLEAN" && (
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-2xl bg-[#17181D] border border-[#343740]">
                <div>
                  <label className="block text-xs font-semibold text-[#8E929E] mb-1">
                    Objectif cible
                  </label>
                  <input
                    type="number"
                    placeholder="ex: 50"
                    value={form.targetValue || ""}
                    onChange={(e) =>
                      form.setTargetValue(parseFloat(e.target.value) || undefined)
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8E929E] mb-1">
                    Unité
                  </label>
                  <input
                    type="text"
                    placeholder="ex: reps, pages"
                    value={form.unit}
                    onChange={(e) => form.setUnit(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion: Projet */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => form.toggleSection("project")}
          className="w-full p-2.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <FolderKanban className="w-4 h-4 text-[#D4F63D]" />
            <span className="text-xs font-bold text-white">Projet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
              {form.projectId
                ? projects.find((p) => p.id === form.projectId)?.name || "…"
                : "Aucun"}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                form.expandedSections.project ? "rotate-180 text-white" : "",
              )}
            />
          </div>
        </button>

        {form.expandedSections.project && (
          <div className="p-2.5 pt-1 border-t border-[#2B2E39] space-y-2.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => form.setProjectId(null)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all text-center truncate cursor-pointer",
                  !form.projectId
                    ? "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D]"
                    : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]",
                )}
              >
                Aucun projet
              </button>
              {projects.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    form.setProjectId(p.id);
                    form.setProjectStatus(getProjectColumns(p)[0].id);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all text-center truncate cursor-pointer flex items-center justify-center gap-1.5",
                    form.projectId === p.id
                      ? "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D]"
                      : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]",
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => form.setIsNewProjectOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed border-[#4B5563] text-[#8E929E] hover:border-[#D4F63D] hover:text-[#D4F63D] transition-all text-center truncate cursor-pointer"
              >
                + Nouveau
              </button>
            </div>

            {form.projectId && (
              <div className="pt-2 border-t border-[#343740] space-y-2">
                <span className="block text-[11px] font-semibold text-[#8E929E]">
                  Colonne
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {getProjectColumns(
                    projects.find((p) => p.id === form.projectId) || {
                      columns: [],
                    },
                  ).map((col) => (
                    <button
                      type="button"
                      key={col.id}
                      onClick={() => form.setProjectStatus(col.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                        form.projectStatus === col.id
                          ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold shadow-sm"
                          : "bg-[#1C1D22] border-[#343740] text-[#D1D5DB] hover:border-[#4B5563]",
                      )}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
