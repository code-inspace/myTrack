"use client";

import React, { useState } from "react";
import { TaskFormValues } from "../types";
import { TASK_CATEGORIES, TRACKING_TYPE_OPTIONS, RECURRENCE_OPTIONS, DAYS_OF_WEEK } from "../options";
import { X, Plus, Sparkles, Clock, Target, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
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
  const [reminderTime, setReminderTime] = useState("18:00");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
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
      reminderTime: reminderTime || undefined,
    });

    // Reset and close
    setTitle("");
    setDescription("");
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
            <h2 className="text-xl font-bold text-white">Create New Task</h2>
            <p className="text-xs text-[#8E929E] mt-0.5">Define your daily habit or goal</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#252830] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Task Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E] mb-2">
              Task Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Push-ups, Read 20 pages, Deep work..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] text-white text-sm outline-none transition-all placeholder-[#6B7280]"
            />
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E] mb-2">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TASK_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center truncate",
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
              Tracking Type
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
                    "p-3 rounded-2xl border text-left transition-all",
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
                  Target Value
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={targetValue || ""}
                  onChange={(e) => setTargetValue(parseFloat(e.target.value) || undefined)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1C1D22] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                  Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g. reps, min, pages"
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
              Recurrence
            </label>
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map((rec) => (
                <button
                  type="button"
                  key={rec.id}
                  onClick={() => setRecurrence(rec.id as any)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all",
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
                        "w-9 h-9 rounded-full text-xs font-bold transition-all",
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

          {/* Time Window */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-[0.98] text-[#111214] font-bold text-base shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            Create Task
          </button>
        </form>
      </div>
    </div>
  );
};
