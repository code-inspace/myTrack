"use client";

import React from "react";
import {
  Repeat,
  Clock,
  CalendarDays,
  BellRing,
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskFormState } from "../useTaskForm";
import { RECURRENCE_OPTIONS, DAYS_OF_WEEK } from "@/features/tasks/options";
import { subtractMinutesFromTime } from "@/lib/dates";

const OFFSET_OPTIONS = [
  { value: 0, label: "À l'heure pile" },
  { value: 5, label: "5 min avant" },
  { value: 10, label: "10 min avant (défaut)" },
  { value: 15, label: "15 min avant" },
  { value: 30, label: "30 min avant" },
  { value: 60, label: "1h avant" },
];

interface TaskFormScheduleSectionProps {
  form: TaskFormState;
}

export const TaskFormScheduleSection: React.FC<TaskFormScheduleSectionProps> = ({
  form,
}) => {
  const currentRecurrenceObj =
    RECURRENCE_OPTIONS.find((r) => r.id === form.recurrence) ||
    RECURRENCE_OPTIONS[0];

  return (
    <div className="space-y-2.5">
      {/* Accordion: Récurrence */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => form.toggleSection("recurrence")}
          className="w-full p-2.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Repeat className="w-4 h-4 text-[#D4F63D]" />
            <span className="text-xs font-bold text-white">Récurrence</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
              {currentRecurrenceObj.label}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                form.expandedSections.recurrence ? "rotate-180 text-white" : "",
              )}
            />
          </div>
        </button>

        {form.expandedSections.recurrence && (
          <div className="p-2.5 pt-1.5 border-t border-[#2B2E39] space-y-2.5 animate-in fade-in duration-150">
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map((rec) => (
                <button
                  type="button"
                  key={rec.id}
                  onClick={() => form.setRecurrence(rec.id as any)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                    form.recurrence === rec.id
                      ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold shadow-sm"
                      : "bg-[#1C1D22] border-[#343740] text-[#D1D5DB] hover:border-[#4B5563]",
                  )}
                >
                  {rec.label}
                </button>
              ))}
            </div>

            {form.recurrence === "CUSTOM" && (
              <div className="flex justify-between gap-1.5 pt-2 border-t border-[#343740]">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = form.selectedDays.includes(d.dayIndex);
                  return (
                    <button
                      type="button"
                      key={d.dayIndex}
                      onClick={() => form.toggleDay(d.dayIndex)}
                      className={cn(
                        "w-8 h-8 rounded-full text-xs font-bold transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#D4F63D] text-black ring-2 ring-[#D4F63D]/40"
                          : "bg-[#1C1D22] text-[#8E929E] hover:text-white",
                      )}
                    >
                      {d.short[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion: Horaire */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => form.toggleSection("schedule")}
          className="w-full p-2.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#D4F63D]" />
            <span className="text-xs font-bold text-white">Horaire</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
              {form.hasScheduledTime
                ? `${form.startTime} - ${form.endTime}`
                : "Jour entier"}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                form.expandedSections.schedule ? "rotate-180 text-white" : "",
              )}
            />
          </div>
        </button>

        {form.expandedSections.schedule && (
          <div className="p-2.5 pt-1.5 border-t border-[#2B2E39] space-y-2.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => form.setHasScheduledTime(false)}
                className={cn(
                  "p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                  !form.hasScheduledTime
                    ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                    : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]",
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
                onClick={() => form.setHasScheduledTime(true)}
                className={cn(
                  "p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                  form.hasScheduledTime
                    ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                    : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]",
                )}
              >
                <Clock className="w-4 h-4 text-[#D4F63D] flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Heure précise</div>
                  <div className="text-[10px] text-[#8E929E]">Plage horaire</div>
                </div>
              </button>
            </div>

            {form.hasScheduledTime && (
              <div className="p-2.5 rounded-2xl bg-[#17181D] border border-[#2F323E] overflow-hidden">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex-1 min-w-0 space-y-1">
                    <label className="block text-[11px] font-semibold text-[#8E929E] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#D4F63D]" />
                      <span>Début</span>
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => form.handleStartTimeChange(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl bg-[#252830] border border-[#343740] text-white font-mono font-bold text-sm focus:border-[#D4F63D] outline-none text-center box-border"
                    />
                  </div>

                  <div className="text-xs text-[#8E929E] font-bold pt-4">➔</div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <label className="block text-[11px] font-semibold text-[#8E929E] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#8E929E]" />
                      <span>Fin</span>
                    </label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => form.setEndTime(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl bg-[#252830] border border-[#343740] text-white font-mono font-bold text-sm focus:border-[#D4F63D] outline-none text-center box-border"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion: Rappels */}
      <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => form.toggleSection("reminders")}
          className="w-full p-2.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BellRing className="w-4 h-4 text-[#D4F63D]" />
            <span className="text-xs font-bold text-white">Rappels</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
              {!form.enableReminders
                ? "Désactivé"
                : form.hasScheduledTime
                  ? `10 min avant (${subtractMinutesFromTime(form.startTime, form.reminderOffsetMinutes)})`
                  : `${form.reminderTimes.length} rappels (${form.reminderTimes.join(", ")})`}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                form.expandedSections.reminders ? "rotate-180 text-white" : "",
              )}
            />
          </div>
        </button>

        {form.expandedSections.reminders && (
          <div className="p-2.5 pt-1.5 border-t border-[#2B2E39] space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white font-medium">
                Activer les notifications
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enableReminders}
                  onChange={(e) => form.setEnableReminders(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#343740] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4F63D]" />
              </label>
            </div>

            {form.enableReminders && (
              <div className="pt-2 border-t border-[#2B2E39] space-y-2">
                {form.hasScheduledTime ? (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-[#8E929E]">
                      Moment du rappel :
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {OFFSET_OPTIONS.map((opt) => (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => form.setReminderOffsetMinutes(opt.value)}
                          className={cn(
                            "py-1.5 px-2 rounded-xl text-[11px] font-medium border text-center transition-all cursor-pointer truncate",
                            form.reminderOffsetMinutes === opt.value
                              ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold shadow-sm"
                              : "bg-[#1C1D22] border-[#343740] text-[#D1D5DB] hover:border-[#4B5563]",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-2.5 p-2 rounded-xl bg-[#17181D] border border-[#2B2E38] flex items-center justify-between text-xs">
                      <span className="text-[#8E929E]">
                        Notification prévue à :
                      </span>
                      <span className="font-mono font-bold text-[#D4F63D]">
                        ⏰{" "}
                        {subtractMinutesFromTime(
                          form.startTime,
                          form.reminderOffsetMinutes,
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#8E929E]">
                        Heures des rappels ({form.reminderTimes.length}) :
                      </span>
                      <button
                        type="button"
                        onClick={form.handleAddAllDayReminder}
                        className="text-[11px] font-bold text-[#D4F63D] hover:underline flex items-center gap-1 cursor-pointer bg-[#1C1D22] px-2.5 py-1 rounded-lg border border-[#343740]"
                      >
                        <Plus className="w-3 h-3" />
                        Ajouter un rappel
                      </button>
                    </div>

                    <div className="space-y-2">
                      {form.reminderTimes.map((rTime, idx) => (
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
                              onChange={(e) =>
                                form.handleUpdateAllDayReminderTime(
                                  idx,
                                  e.target.value,
                                )
                              }
                              className="h-8 px-2 rounded-lg bg-[#252830] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none text-center box-border"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => form.handleRemoveAllDayReminder(idx)}
                            disabled={form.reminderTimes.length <= 1}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              form.reminderTimes.length > 1
                                ? "text-[#8E929E] hover:text-red-400 hover:bg-[#252830] cursor-pointer"
                                : "text-[#4B5563] cursor-not-allowed opacity-40",
                            )}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
