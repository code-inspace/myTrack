"use client";

import React, { useState, useEffect } from "react";
import { Task, TaskFormValues, TaskWithCompletion } from "../types";
import { TASK_CATEGORIES, TRACKING_TYPE_OPTIONS, RECURRENCE_OPTIONS, DAYS_OF_WEEK } from "../options";
import { X, Plus, Check, Edit3, Clock, CalendarDays, Bell, BellRing, Trash2, ChevronDown } from "lucide-react";
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

function subtractMinutesFromTime(timeStr: string, minutesToSubtract: number): string {
  if (!timeStr || !timeStr.includes(":")) return "08:50";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  let totalMinutes = h * 60 + m - minutesToSubtract;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

const OFFSET_OPTIONS = [
  { value: 0, label: "À l'heure pile" },
  { value: 5, label: "5 min avant" },
  { value: 10, label: "10 min avant (défaut)" },
  { value: 15, label: "15 min avant" },
  { value: 30, label: "30 min avant" },
  { value: 60, label: "1h avant" },
];

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
  const [hasScheduledTime, setHasScheduledTime] = useState<boolean>(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<"ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM">("ONCE");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Notifications & Reminders State
  const [enableReminders, setEnableReminders] = useState<boolean>(true);
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number>(10);
  const [reminderTimes, setReminderTimes] = useState<string[]>(["11:00", "18:00"]);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
      setCategory(initialTask.category || "Fitness");
      setTrackingType(initialTask.trackingType || "BOOLEAN");
      setTargetValue(initialTask.targetValue || undefined);
      setUnit(initialTask.unit || "");
      const taskHasTime = Boolean(initialTask.startTime);
      setHasScheduledTime(taskHasTime);
      setStartTime(initialTask.startTime || "09:00");
      setEndTime(
        initialTask.endTime ||
          (initialTask.startTime ? addHoursToTimeString(initialTask.startTime, 1) : "10:00")
      );
      setRecurrence(initialTask.recurrence || "ONCE");
      setSelectedDays(initialTask.recurrenceConfig?.days || [1, 2, 3, 4, 5]);
      setEnableReminders(initialTask.enableReminders !== undefined ? initialTask.enableReminders : true);
      setReminderOffsetMinutes(initialTask.reminderOffsetMinutes ?? 10);
      setReminderTimes(initialTask.reminderTimes && initialTask.reminderTimes.length > 0 ? initialTask.reminderTimes : ["11:00", "18:00"]);
    } else {
      setTitle("");
      setDescription("");
      setCategory("Fitness");
      setTrackingType("BOOLEAN");
      setTargetValue(undefined);
      setUnit("");
      setHasScheduledTime(false);
      setStartTime("09:00");
      setEndTime("10:00");
      setRecurrence("ONCE");
      setSelectedDays([1, 2, 3, 4, 5]);
      setEnableReminders(true);
      setReminderOffsetMinutes(10);
      setReminderTimes(["11:00", "18:00"]);
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

  const handleAddAllDayReminder = () => {
    const nextHour = reminderTimes.length === 0 ? "11:00" : reminderTimes.length === 1 ? "18:00" : "20:00";
    setReminderTimes([...reminderTimes, nextHour]);
  };

  const handleRemoveAllDayReminder = (index: number) => {
    setReminderTimes(reminderTimes.filter((_, idx) => idx !== index));
  };

  const handleUpdateAllDayReminderTime = (index: number, newTime: string) => {
    const updated = [...reminderTimes];
    updated[index] = newTime;
    setReminderTimes(updated);
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
        startTime: hasScheduledTime && startTime ? startTime : undefined,
        endTime: hasScheduledTime && endTime ? endTime : undefined,
        recurrence,
        recurrenceConfig: recurrence === "CUSTOM" ? { days: selectedDays } : undefined,
        enableReminders,
        reminderOffsetMinutes: hasScheduledTime ? reminderOffsetMinutes : undefined,
        reminderTimes: !hasScheduledTime ? reminderTimes : undefined,
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
      <div className="w-full max-w-lg bg-[#1C1D22] border border-[#282A30] rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto my-auto space-y-5">
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

        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Time Scheduling Mode: [Jour entier (par défaut)] vs [Heure précise] */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E] mb-2">
              Programmation horaire
            </label>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setHasScheduledTime(false)}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                  !hasScheduledTime
                    ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                    : "bg-[#252830] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                )}
              >
                <CalendarDays className="w-4 h-4 text-[#D4F63D] flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Jour entier</div>
                  <div className="text-[10px] text-[#8E929E]">Sans heure fixe</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHasScheduledTime(true)}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                  hasScheduledTime
                    ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                    : "bg-[#252830] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                )}
              >
                <Clock className="w-4 h-4 text-[#D4F63D] flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Heure précise</div>
                  <div className="text-[10px] text-[#8E929E]">Plage horaire</div>
                </div>
              </button>
            </div>

            {/* Time Window with clean separate styled inputs */}
            {hasScheduledTime && (
              <div className="grid grid-cols-2 gap-4 p-3.5 rounded-2xl bg-[#252830]/80 border border-[#343740] animate-in fade-in duration-150">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#8E929E] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#D4F63D]" />
                    <span>Heure de début</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1D22] border border-[#343740] text-white font-semibold text-sm focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#8E929E] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#8E929E]" />
                    <span>Heure de fin</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1D22] border border-[#343740] text-white font-semibold text-sm focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] outline-none transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* Notifications & Reminders Configuration Section                           */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-[#22242B] border border-[#30333E] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#D4F63D]/15 text-[#D4F63D] flex items-center justify-center">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Rappels & Notifications</h4>
                  <p className="text-[10px] text-[#8E929E]">
                    {hasScheduledTime
                      ? "Alerte automatique avant l'heure de la tâche"
                      : "Rappels programmés dans la journée"}
                  </p>
                </div>
              </div>

              {/* Master Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableReminders}
                  onChange={(e) => setEnableReminders(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#343740] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4F63D]" />
              </label>
            </div>

            {enableReminders && (
              <div className="pt-2 border-t border-[#2F323E] space-y-3 animate-in fade-in duration-150">
                {/* CASE A: Timed Task - 10 min before default offset */}
                {hasScheduledTime ? (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-[#8E929E]">
                      Moment du rappel :
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {OFFSET_OPTIONS.map((opt) => (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => setReminderOffsetMinutes(opt.value)}
                          className={cn(
                            "py-2 px-2 rounded-xl text-[11px] font-medium border text-center transition-all cursor-pointer truncate",
                            reminderOffsetMinutes === opt.value
                              ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold shadow-sm"
                              : "bg-[#1C1D22] border-[#343740] text-[#D1D5DB] hover:border-[#4B5563]"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Calculated reminder time pill */}
                    <div className="mt-2.5 p-2 rounded-xl bg-[#17181D] border border-[#2B2E38] flex items-center justify-between text-xs">
                      <span className="text-[#8E929E]">Notification prévue à :</span>
                      <span className="font-mono font-bold text-[#D4F63D]">
                        ⏰ {subtractMinutesFromTime(startTime, reminderOffsetMinutes)}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* CASE B: All-day Task - 2 reminders default (11:00 & 18:00), editable count and time */
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#8E929E]">
                        Heures des rappels ({reminderTimes.length}) :
                      </span>
                      <button
                        type="button"
                        onClick={handleAddAllDayReminder}
                        className="text-[11px] font-bold text-[#D4F63D] hover:underline flex items-center gap-1 cursor-pointer bg-[#1C1D22] px-2.5 py-1 rounded-lg border border-[#343740]"
                      >
                        <Plus className="w-3 h-3" />
                        Ajouter un rappel
                      </button>
                    </div>

                    {/* List of reminder times */}
                    <div className="space-y-2">
                      {reminderTimes.map((rTime, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#1C1D22] border border-[#2B2E38]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8E929E] font-medium">
                              Rappel {idx + 1} :
                            </span>
                            <input
                              type="time"
                              value={rTime}
                              onChange={(e) => handleUpdateAllDayReminderTime(idx, e.target.value)}
                              className="px-2.5 py-1 rounded-lg bg-[#252830] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAllDayReminder(idx)}
                            disabled={reminderTimes.length <= 1}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              reminderTimes.length > 1
                                ? "text-[#8E929E] hover:text-red-400 hover:bg-[#252830] cursor-pointer"
                                : "text-[#4B5563] cursor-not-allowed opacity-40"
                            )}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-[#8E929E] italic">
                      💡 Proposition automatique à 11h et 18h. Tu peux modifier les heures ou en ajouter d'autres.
                    </p>
                  </div>
                )}
              </div>
            )}
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
