"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Moon, Sun, Sparkles, Clock, Calendar, X, Trash2, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredSleepLog, saveStoredSleepLog, saveStoredSleepTarget } from "../actions";
import { DailySleepLog, NapSession } from "../types";
import { format, parseISO, differenceInMinutes, subDays } from "date-fns";
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  // Initialize session state on open
  useEffect(() => {
    if (isOpen && initialSession) {
      isInitialMountRef.current = true;
      const type = initialSession.sessionType || "night";
      setSessionType(type);

      const initEndDate = initialSession.endDate || format(new Date(), "yyyy-MM-dd");
      const initStartTime = initialSession.startTime || "23:00";
      const initEndTime = initialSession.endTime || "07:30";

      let initStartDate = initialSession.startDate || initEndDate;
      if (type === "night") {
        const hour = parseInt(initStartTime.split(":")[0], 10) || 0;
        // If bedtime is in early morning (< 12h, e.g. 03:00), bedtime date is the same day as wake-up
        if (hour < 12) {
          initStartDate = initEndDate;
        } else if (initStartDate === initEndDate) {
          initStartDate = format(subDays(parseISO(initEndDate), 1), "yyyy-MM-dd");
        }
      }

      setStartDate(initStartDate);
      setStartTime(initStartTime);
      setEndDate(initEndDate);
      setEndTime(initEndTime);
      setNapId(initialSession.napId);
      setConfirmDelete(false);
      setSaveStatus("idle");

      // Mark mount complete after a short tick
      setTimeout(() => {
        isInitialMountRef.current = false;
      }, 50);
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
        return { isValid: false, text: "L'heure de réveil doit être après le coucher", diffMins: 0, hours: 0, minutes: 0 };
      }

      const hours = Math.floor(diffMins / 60);
      const minutes = diffMins % 60;
      const text = `${hours}h ${String(minutes).padStart(2, "0")}m`;
      return { isValid: true, text, diffMins, hours, minutes };
    } catch {
      return null;
    }
  }, [startDate, startTime, endDate, endTime]);

  // Core save routine
  const performSave = useCallback(
    async (
      currType: "night" | "nap",
      sDate: string,
      sTime: string,
      eDate: string,
      eTime: string,
      currentNapId?: string
    ) => {
      try {
        const startDt = parseISO(`${sDate}T${sTime}:00`);
        const endDt = parseISO(`${eDate}T${eTime}:00`);
        const diff = differenceInMinutes(endDt, startDt);
        if (diff <= 0) return;

        setSaveStatus("saving");

        if (currType === "night") {
          // Night session bedtime key in DailySleepLog is the eve date
          const nightLogKey = format(subDays(parseISO(eDate), 1), "yyyy-MM-dd");

          const startLog = getStoredSleepLog(nightLogKey);
          await saveStoredSleepLog({
            ...startLog,
            bedtime: sTime,
            bedtimeValidated: true,
            updatedAt: new Date().toISOString(),
          });

          // WakeTime belongs to endDate
          const endLog = getStoredSleepLog(eDate);
          await saveStoredSleepLog({
            ...endLog,
            wakeTime: eTime,
            wakeTimeValidated: true,
            updatedAt: new Date().toISOString(),
          });

          // Update default Sleep Target globally for the user
          saveStoredSleepTarget({
            targetBedtime: sTime,
            targetWakeTime: eTime,
          });
        } else {
          // Nap session
          const dayLog = getStoredSleepLog(sDate);
          const existingNaps = dayLog.naps || [];
          let updatedNaps: NapSession[];

          if (currentNapId) {
            updatedNaps = existingNaps.map((n) =>
              n.id === currentNapId ? { ...n, startTime: sTime, endTime: eTime } : n
            );
          } else {
            updatedNaps = [
              ...existingNaps,
              { id: "nap-" + Date.now(), startTime: sTime, endTime: eTime },
            ];
          }

          await saveStoredSleepLog({
            ...dayLog,
            naps: updatedNaps,
            updatedAt: new Date().toISOString(),
          });
        }

        // Dispatch event to refresh Agenda and Sleep Dashboard
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mytrack:sleep-auto-detected"));
        }

        onSaved?.();
        setSaveStatus("saved");

        setTimeout(() => {
          setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2000);
      } catch (err) {
        console.error("Failed to auto-save sleep session:", err);
        setSaveStatus("idle");
      }
    },
    [onSaved]
  );

  // Trigger auto-save whenever fields change after initialization
  const triggerAutoSave = useCallback(
    (
      newType: "night" | "nap",
      newStartDate: string,
      newStartTime: string,
      newEndDate: string,
      newEndTime: string,
      immediate = false
    ) => {
      if (isInitialMountRef.current) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (immediate) {
        performSave(newType, newStartDate, newStartTime, newEndDate, newEndTime, napId);
      } else {
        setSaveStatus("saving");
        saveTimeoutRef.current = setTimeout(() => {
          performSave(newType, newStartDate, newStartTime, newEndDate, newEndTime, napId);
        }, 400);
      }
    },
    [napId, performSave]
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen || !initialSession) return null;

  const handleStartTimeChange = (newTime: string) => {
    setStartTime(newTime);
    let targetStartDate = startDate;

    if (sessionType === "night" && endDate) {
      const hour = parseInt(newTime.split(":")[0], 10) || 0;
      targetStartDate = hour < 12 ? endDate : format(subDays(parseISO(endDate), 1), "yyyy-MM-dd");
      setStartDate(targetStartDate);
    }

    triggerAutoSave(sessionType, targetStartDate, newTime, endDate, endTime);
  };

  const handleStartDateChange = (newDate: string) => {
    setStartDate(newDate);
    triggerAutoSave(sessionType, newDate, startTime, endDate, endTime);
  };

  const handleEndTimeChange = (newTime: string) => {
    setEndTime(newTime);
    triggerAutoSave(sessionType, startDate, startTime, endDate, newTime);
  };

  const handleEndDateChange = (newDate: string) => {
    setEndDate(newDate);
    let targetStartDate = startDate;

    if (sessionType === "night") {
      const hour = parseInt(startTime.split(":")[0], 10) || 0;
      targetStartDate = hour < 12 ? newDate : format(subDays(parseISO(newDate), 1), "yyyy-MM-dd");
      setStartDate(targetStartDate);
    }

    triggerAutoSave(sessionType, targetStartDate, startTime, newDate, endTime);
  };

  const handleQuickAdjust = (type: "start" | "end", minutesDelta: number) => {
    try {
      if (type === "start") {
        const dt = parseISO(`${startDate}T${startTime}:00`);
        const newDt = new Date(dt.getTime() + minutesDelta * 60000);
        const newStartDate = format(newDt, "yyyy-MM-dd");
        const newStartTime = format(newDt, "HH:mm");
        setStartDate(newStartDate);
        setStartTime(newStartTime);
        triggerAutoSave(sessionType, newStartDate, newStartTime, endDate, endTime, true);
      } else {
        const dt = parseISO(`${endDate}T${endTime}:00`);
        const newDt = new Date(dt.getTime() + minutesDelta * 60000);
        const newEndDate = format(newDt, "yyyy-MM-dd");
        const newEndTime = format(newDt, "HH:mm");
        setEndDate(newEndDate);
        setEndTime(newEndTime);

        let targetStartDate = startDate;
        if (sessionType === "night") {
          const hour = parseInt(startTime.split(":")[0], 10) || 0;
          targetStartDate = hour < 12 ? newEndDate : format(subDays(parseISO(newEndDate), 1), "yyyy-MM-dd");
          setStartDate(targetStartDate);
        }

        triggerAutoSave(sessionType, targetStartDate, startTime, newEndDate, newEndTime, true);
      }
    } catch (e) {
      console.warn("Error adjusting sleep time:", e);
    }
  };

  const handleDelete = async () => {
    try {
      if (sessionType === "night") {
        const nightLogKey = format(subDays(parseISO(endDate), 1), "yyyy-MM-dd");

        const startLog = getStoredSleepLog(nightLogKey);
        await saveStoredSleepLog({
          ...startLog,
          bedtime: null,
          bedtimeValidated: false,
          updatedAt: new Date().toISOString(),
        });

        if (startDate !== nightLogKey) {
          const otherLog = getStoredSleepLog(startDate);
          await saveStoredSleepLog({
            ...otherLog,
            bedtime: null,
            bedtimeValidated: false,
            updatedAt: new Date().toISOString(),
          });
        }

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
      <div className="modal-adaptive-card w-full max-w-sm max-h-[90vh] bg-[#17192C] border border-[#2E3352] rounded-3xl p-5 shadow-2xl relative flex flex-col space-y-4 my-auto overflow-hidden text-white">
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

        {/* Live Duration Banner & Autosave State */}
        <div className="p-3 rounded-2xl bg-[#20233B] border border-[#373C60] flex items-center justify-between flex-shrink-0">
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
        <div className="flex-1 overflow-y-auto overscroll-contain pr-1 pb-6 space-y-4 min-h-0">
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
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#242842] border border-[#373C60] text-xs font-semibold text-white focus:border-[#818CF8] outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-semibold">Heure</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
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
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#242842] border border-[#373C60] text-xs font-semibold text-white focus:border-[#FCD34D] outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#64748B] uppercase font-semibold">Heure</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
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

          {/* Autosave Status Indicator */}
          <div className="pt-1">
            {saveStatus === "saving" && (
              <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-[#818CF8]/10 border border-[#818CF8]/25 text-[#818CF8] text-xs font-bold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sauvegarde automatique...</span>
              </div>
            )}
            {saveStatus === "saved" && (
              <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-[#D4F63D]/10 border border-[#D4F63D]/30 text-[#D4F63D] text-xs font-bold animate-in fade-in duration-200">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Enregistré automatiquement</span>
              </div>
            )}
            {saveStatus === "idle" && (
              <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-[#20233B] border border-[#2E3352]/60 text-[#94A3B8] text-[11px] font-medium">
                <Sparkles className="w-3 h-3 text-[#818CF8]" />
                <span>Sauvegarde automatique en continu</span>
              </div>
            )}
          </div>

          {/* Close Action */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-[#242842] hover:bg-[#2F3456] text-white font-bold text-xs transition-all cursor-pointer shadow"
          >
            Fermer
          </button>

          {/* Delete Option */}
          <div className="pt-2 border-t border-[#2E3352]">
            {confirmDelete ? (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2 animate-in fade-in">
                <p className="text-xs text-red-300 font-medium">
                  Supprimer cette session de sommeil ? Les heures associées seront réinitialisées.
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
                className="w-full py-2 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer cette session</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
