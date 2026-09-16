"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Moon, Sun, Sparkles, Clock, Calendar, X, Trash2, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredSleepLog, saveStoredSleepLog } from "../actions";
import { DailySleepLog, NapSession } from "../types";
import { format, parseISO, differenceInMinutes, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";

export interface SleepSessionData {
  sessionType: "night" | "nap";
  startDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endDate: string;   // "YYYY-MM-DD"
  endTime: string;   // "HH:MM"
  napId?: string;
}

interface SleepEditModalProps {
  isOpen: boolean;
  initialSession: SleepSessionData | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const SleepEditModal: React.FC<SleepEditModalProps> = ({
  isOpen,
  initialSession,
  onClose,
  onSaved,
}) => {
  const [sessionType, setSessionType] = useState<"night" | "nap">("night");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("23:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("07:30");
  const [napId, setNapId] = useState<string | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen && initialSession) {
      setSessionType(initialSession.sessionType || "night");
      setStartDate(initialSession.startDate || format(new Date(), "yyyy-MM-dd"));
      setStartTime(initialSession.startTime || "23:00");
      setEndDate(initialSession.endDate || format(new Date(), "yyyy-MM-dd"));
      setEndTime(initialSession.endTime || "07:30");
      setNapId(initialSession.napId);
      setConfirmDelete(false);
    }
  }, [isOpen, initialSession]);

  // Compute live duration
  const durationInfo = useMemo(() => {
    if (!startDate || !startTime || !endDate || !endTime) return null;
    try {
      const startDt = parseISO(`${startDate}T${startTime}:00`);
      const endDt = parseISO(`${endDate}T${endTime}:00`);
      const diffMins = differenceInMinutes(endDt, startDt);

      if (diffMins <= 0) {
        return { isValid: false, text: "L'heure de fin doit être après le début", diffMins: 0, hours: 0, minutes: 0 };
      }

      const hours = Math.floor(diffMins / 60);
      const minutes = diffMins % 60;
      const text = `${hours}h ${String(minutes).padStart(2, "0")}m`;
      return { isValid: true, text, diffMins, hours, minutes };
    } catch {
      return null;
    }
  }, [startDate, startTime, endDate, endTime]);

  if (!isOpen || !initialSession) return null;

  const handleQuickAdjust = (type: "start" | "end", minutesDelta: number) => {
    try {
      if (type === "start") {
        const dt = parseISO(`${startDate}T${startTime}:00`);
        const newDt = new Date(dt.getTime() + minutesDelta * 60000);
        setStartDate(format(newDt, "yyyy-MM-dd"));
        setStartTime(format(newDt, "HH:mm"));
      } else {
        const dt = parseISO(`${endDate}T${endTime}:00`);
        const newDt = new Date(dt.getTime() + minutesDelta * 60000);
        setEndDate(format(newDt, "yyyy-MM-dd"));
        setEndTime(format(newDt, "HH:mm"));
      }
    } catch (e) {
      console.warn("Error adjusting sleep time:", e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!durationInfo?.isValid) return;

    try {
      if (sessionType === "night") {
        // 1. Bedtime belongs to startDate
        const startLog = getStoredSleepLog(startDate);
        const updatedStartLog: DailySleepLog = {
          ...startLog,
          bedtime: startTime,
          bedtimeValidated: true,
          updatedAt: new Date().toISOString(),
        };
        await saveStoredSleepLog(updatedStartLog);

        // 2. WakeTime belongs to endDate
        const endLog = getStoredSleepLog(endDate);
        const updatedEndLog: DailySleepLog = {
          ...endLog,
          wakeTime: endTime,
          wakeTimeValidated: true,
          updatedAt: new Date().toISOString(),
        };
        await saveStoredSleepLog(updatedEndLog);
      } else {
        // Nap session
        const dayLog = getStoredSleepLog(startDate);
        const existingNaps = dayLog.naps || [];
        let updatedNaps: NapSession[];

        if (napId) {
          updatedNaps = existingNaps.map((n) =>
            n.id === napId ? { ...n, startTime, endTime } : n
          );
        } else {
          updatedNaps = [
            ...existingNaps,
            { id: "nap-" + Date.now(), startTime, endTime },
          ];
        }

        const updatedDayLog: DailySleepLog = {
          ...dayLog,
          naps: updatedNaps,
          updatedAt: new Date().toISOString(),
        };
        await saveStoredSleepLog(updatedDayLog);
      }

      // Dispatch event to refresh Agenda and Sleep Dashboard
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mytrack:sleep-auto-detected"));
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to save sleep session:", err);
    }
  };

  const handleDelete = async () => {
    try {
      if (sessionType === "night") {
        // Reset bedtime and wakeTime
        const startLog = getStoredSleepLog(startDate);
        await saveStoredSleepLog({
          ...startLog,
          bedtime: null,
          bedtimeValidated: false,
          updatedAt: new Date().toISOString(),
        });

        const endLog = getStoredSleepLog(endDate);
        await saveStoredSleepLog({
          ...endLog,
          wakeTime: null,
          wakeTimeValidated: false,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Remove nap
        const dayLog = getStoredSleepLog(startDate);
        const updatedNaps = (dayLog.naps || []).filter((n) => n.id !== napId);
        await saveStoredSleepLog({
          ...dayLog,
          naps: updatedNaps,
          updatedAt: new Date().toISOString(),
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mytrack:sleep-auto-detected"));
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to delete sleep session:", err);
    }
  };

  const formatFrenchDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "EEE d MMM", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm max-h-[90vh] bg-[#17192C] border border-[#2E3352] rounded-3xl p-5 shadow-2xl relative flex flex-col space-y-4 my-auto overflow-hidden text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2E3352] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {sessionType === "nap" ? (
              <div className="p-2 rounded-xl bg-[#A5B4FC]/20 text-[#A5B4FC]">
                <Sparkles className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-[#818CF8]/20 text-[#818CF8]">
                <Moon className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {sessionType === "nap" ? "Modifier la Sieste" : "Modifier le Sommeil"}
              </h2>
              <span className="text-[11px] text-[#94A3B8]">
                {sessionType === "nap" ? "Temps de repos diurne" : "Nuit de sommeil"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-2 rounded-full bg-[#242842] transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Duration Banner */}
        <div className="p-3 rounded-2xl bg-[#20233B] border border-[#373C60] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#818CF8]" />
            <span className="text-xs text-[#94A3B8] font-medium">Durée totale</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono font-extrabold text-sm">
            {durationInfo?.isValid ? (
              <span className="text-[#D4F63D] bg-[#D4F63D]/10 px-2.5 py-1 rounded-xl border border-[#D4F63D]/30">
                {durationInfo.text}
              </span>
            ) : (
              <span className="text-red-400 text-xs font-sans font-medium">
                {durationInfo?.text || "Invalide"}
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0">
          {/* 1. Date et Heure de Début (Coucher) */}
          <div className="p-3.5 rounded-2xl bg-[#1D2038] border border-[#2E3352] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#A5B4FC]">
                <Moon className="w-3.5 h-3.5" />
                <span>Début (Coucher)</span>
              </label>
              <span className="text-[11px] text-[#94A3B8] font-medium">
                {formatFrenchDate(startDate)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-semibold">Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#242842] border border-[#373C60] text-xs font-semibold text-white focus:border-[#818CF8] outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-semibold">Heure</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#242842] border border-[#373C60] text-xs font-mono font-bold text-[#D4F63D] focus:border-[#818CF8] outline-none text-center"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleQuickAdjust("start", -15)}
                className="flex-1 py-1 rounded-lg bg-[#242842] hover:bg-[#2F3456] text-[10px] font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              >
                -15 min
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdjust("start", 15)}
                className="flex-1 py-1 rounded-lg bg-[#242842] hover:bg-[#2F3456] text-[10px] font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              >
                +15 min
              </button>
            </div>
          </div>

          {/* 2. Date et Heure de Fin (Réveil) */}
          <div className="p-3.5 rounded-2xl bg-[#1D2038] border border-[#2E3352] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FCD34D]">
                <Sun className="w-3.5 h-3.5" />
                <span>Fin (Réveil)</span>
              </label>
              <span className="text-[11px] text-[#94A3B8] font-medium">
                {formatFrenchDate(endDate)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-semibold">Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#242842] border border-[#373C60] text-xs font-semibold text-white focus:border-[#FCD34D] outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-semibold">Heure</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#242842] border border-[#373C60] text-xs font-mono font-bold text-[#D4F63D] focus:border-[#FCD34D] outline-none text-center"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleQuickAdjust("end", -15)}
                className="flex-1 py-1 rounded-lg bg-[#242842] hover:bg-[#2F3456] text-[10px] font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              >
                -15 min
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdjust("end", 15)}
                className="flex-1 py-1 rounded-lg bg-[#242842] hover:bg-[#2F3456] text-[10px] font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              >
                +15 min
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!durationInfo?.isValid}
            className={cn(
              "w-full py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer",
              durationInfo?.isValid
                ? "bg-[#818CF8] hover:bg-[#6366F1] text-white shadow-indigo-500/20 active:scale-[0.98]"
                : "bg-[#2E3352] text-[#64748B] cursor-not-allowed opacity-60"
            )}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Enregistrer la session</span>
          </button>

          {/* Delete Option */}
          <div className="pt-2 border-t border-[#2E3352]">
            {confirmDelete ? (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2 animate-in fade-in">
                <p className="text-xs text-red-300 font-medium">
                  Supprimer cette session de sommeil ? Les heures de coucher et de réveil associées seront réinitialisées.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    Confirmer la suppression
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-xl bg-[#242842] hover:bg-[#2F3456] text-[#94A3B8] hover:text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer cette session</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
