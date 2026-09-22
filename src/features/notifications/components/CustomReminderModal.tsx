"use client";

import React, { useState } from "react";
import { CustomReminder } from "../types";
import { Task } from "@/features/tasks/types";
import { DAYS_OF_WEEK } from "@/features/tasks/options";
import { X, Plus, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomReminderModalProps {
  isOpen: boolean;
  tasks: Task[];
  onClose: () => void;
  onSaveReminder: (reminder: Omit<CustomReminder, "id" | "userId">) => void;
}

export const CustomReminderModal: React.FC<CustomReminderModalProps> = ({
  isOpen,
  tasks,
  onClose,
  onSaveReminder,
}) => {
  const [taskId, setTaskId] = useState<string>(tasks[0]?.id || "");
  const [question, setQuestion] = useState("As-tu fait tes pompes aujourd'hui ?");
  const [time, setTime] = useState("18:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTask = tasks.find((t) => t.id === taskId);
    onSaveReminder({
      taskId: taskId || null,
      taskTitle: selectedTask?.title || "Tâche personnalisée",
      question: question.trim(),
      time,
      days: selectedDays,
      enabled: true,
    });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="modal-adaptive-card w-full max-w-md bg-[#1C1D22] border border-[#282A30] rounded-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-[#282A30] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#D4F63D] text-black flex items-center justify-center">
              <Bell className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Rappel personnalisé</h2>
              <p className="text-xs text-[#8E929E]">Notification interactive personnalisée</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-1.5 rounded-full bg-[#252830]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1 pb-4">
          {/* Linked Task */}
          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-1.5">
              Lier à une tâche
            </label>
            <select
              value={taskId}
              onChange={(e) => {
                setTaskId(e.target.value);
                const t = tasks.find((item) => item.id === e.target.value);
                if (t) {
                  setQuestion(`As-tu fait ta session de ${t.title.toLowerCase()} aujourd'hui ?`);
                }
              }}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Question */}
          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-1.5">
              Question de la notification
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="ex: As-tu fait tes pompes aujourd'hui ?"
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-1.5">
              Heure du rappel
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
            />
          </div>

          {/* Days (Starting Monday) */}
          <div>
            <label className="block text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-2">
              Répéter les jours
            </label>
            <div className="flex justify-between gap-1">
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
                        ? "bg-[#D4F63D] text-black shadow-sm"
                        : "bg-[#252830] text-[#8E929E] hover:text-white"
                    )}
                  >
                    {d.short[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-[0.98] text-[#111214] font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Enregistrer le rappel
          </button>
        </form>
      </div>
    </div>
  );
};
