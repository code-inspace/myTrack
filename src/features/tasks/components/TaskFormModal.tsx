"use client";

import React, { useState, useEffect } from "react";
import { Task, TaskFormValues, TaskWithCompletion } from "../types";
import { TASK_CATEGORIES, TRACKING_TYPE_OPTIONS, RECURRENCE_OPTIONS, DAYS_OF_WEEK } from "../options";
import { X, Plus, Check, Edit3, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskFormModalProps {
  isOpen: boolean;
  initialTask?: Task | TaskWithCompletion | null;
  onClose: () => void;
  onSubmit: (values: TaskFormValues, taskId?: string) => void;
}

function addHoursToTimeString(timeStr: string, hoursToAdd: number = 1): string {
  if (!timeStr || !timeStr.includes(":")) return "08:00";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const totalMinutes = (h * 60 + m + hoursToAdd * 60) % (24 * 60);
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  initialTask,
  onClose,
  onSubmit,
}) => {
  const isEditing = Boolean(initialTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Fitness");
  const [trackingType, setTrackingType] = useState<"BOOLEAN" | "NUMBER" | "DURATION" | "QUANTITY">("BOOLEAN");
  const [targetValue, setTargetValue] = useState<number | undefined>(undefined);
  const [unit, setUnit] = useState<string>("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [recurrence, setRecurrence] = useState<"ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM">("DAILY");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
      setCategory(initialTask.category || "Fitness");
      setTrackingType(initialTask.trackingType || "BOOLEAN");
      setTargetValue(initialTask.targetValue || undefined);
      setUnit(initialTask.unit || "");
      setStartTime(initialTask.startTime || "07:00");
      setEndTime(initialTask.endTime || addHoursToTimeString(initialTask.startTime || "07:00", 1));
      setRecurrence(initialTask.recurrence || "DAILY");
      setSelectedDays(initialTask.recurrenceConfig?.days || [1, 2, 3, 4, 5]);
    } else {
      setTitle("");
      setDescription("");
      setCategory("Fitness");
      setTrackingType("BOOLEAN");
      setTargetValue(undefined);
      setUnit("");
      setStartTime("07:00");
      setEndTime("08:00");
      setRecurrence("DAILY");
      setSelectedDays([1, 2, 3, 4, 5]);
    }
  }, [initialTask, isOpen]);

  if (!isOpen) return null;

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (newStart) {
      const computedEnd = addHoursToTimeString(newStart, 1);
      setEndTime(computedEnd);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        trackingType,
        targetValue: trackingType !== "BOOLEAN" ? targetValue : undefined,
        unit: trackingType !== "BOOLEAN" ? (unit || "reps") : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        recurrence,
        recurrenceConfig: recurrence === "CUSTOM" ? { days: selectedDays } : undefined,
      },
      initialTask?.id
    );

    onClose();
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1C1D22] border border-[#282A30] rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#282A30]">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit3 className="w-5 h-5 text-[#D4F63D]" />
                  <span>Modifier l'habitude</span>
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
                ? "Modifie les paramètres et enregistre dans Supabase"
                : "Définis ton habitude ou ton objectif"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#252830] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Task Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E] mb-2">
              Nom de la tâche *
            </label>
            <input
              type="text"
              required
              placeholder="ex: Pompes, Lire 20 pages, Deep work..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] text-white text-sm outline-none transition-all placeholder-[#6B7280]"
            />
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E] mb-2">
              Catégorie
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TASK_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center truncate cursor-pointer",
                    category === cat.id
                      ? "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D]"
                      : "bg-[#252830] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                  )}
                >
                  {cat.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Tracking Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E] mb-2">
              Type de suivi
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TRACKING_TYPE_OPTIONS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => {
                    setTrackingType(t.id as any);
                    if (t.defaultUnit && !unit) setUnit(t.defaultUnit);
                    if (t.id === "NUMBER" && !targetValue) setTargetValue(50);
                    if (t.id === "DURATION" && !targetValue) setTargetValue(30);
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all cursor-pointer",
                    trackingType === t.id
                      ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                      : "bg-[#252830] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                  )}
                >
                  <div className="text-xs font-bold text-white">{t.label}</div>
                  <div className="text-[11px] text-[#8E929E] mt-0.5">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target & Unit (if not BOOLEAN) */}
          {trackingType !== "BOOLEAN" && (
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#252830]/80 border border-[#343740]">
              <div>
                <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                  Objectif
                </label>
                <input
                  type="number"
                  placeholder="ex: 50"
                  value={targetValue || ""}
                  onChange={(e) => setTargetValue(parseFloat(e.target.value) || undefined)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1C1D22] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                  Unité
                </label>
                <input
                  type="text"
                  placeholder="ex: reps, pages, verres"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1C1D22] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
                />
              </div>
            </div>
          )}

          {/* Recurrence */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E] mb-2">
              Récurrence
            </label>
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map((rec) => (
                <button
                  type="button"
                  key={rec.id}
                  onClick={() => setRecurrence(rec.id as any)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                    recurrence === rec.id
                      ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold"
                      : "bg-[#252830] border-[#343740] text-[#D1D5DB] hover:border-[#4B5563]"
                  )}
                >
                  {rec.label}
                </button>
              ))}
            </div>

            {/* Custom days selection */}
            {recurrence === "CUSTOM" && (
              <div className="flex justify-between gap-1.5 mt-3 pt-3 border-t border-[#343740]">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = selectedDays.includes(d.dayIndex);
                  return (
                    <button
                      type="button"
                      key={d.dayIndex}
                      onClick={() => toggleDay(d.dayIndex)}
                      className={cn(
                        "w-9 h-9 rounded-full text-xs font-bold transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#D4F63D] text-black ring-2 ring-[#D4F63D]/40"
                          : "bg-[#252830] text-[#8E929E] hover:text-white"
                      )}
                    >
                      {d.short[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time Window with clean separate styled inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#8E929E] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#D4F63D]" />
                <span>Heure de début</span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white font-semibold text-sm focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#8E929E] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#8E929E]" />
                <span>Heure de fin</span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white font-semibold text-sm focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-[0.98] text-[#111214] font-bold text-base shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {isEditing ? (
              <>
                <Check className="w-5 h-5 stroke-[3]" />
                Enregistrer les modifications
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 stroke-[3]" />
                Créer la tâche
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
