"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sparkles, X, Check, Clock, Repeat, Calendar, Trash2, ArrowRight, AlertCircle, Lock } from "lucide-react";
import { TaskFormValues } from "@/features/tasks/types";
import { parseVoiceTranscriptToTasks } from "../parser";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ParsedVoiceTask extends TaskFormValues {
  targetDate?: string;
}

interface VoiceActionModalProps {
  isOpen: boolean;
  selectedDate: string;
  onClose: () => void;
  onAddTasks: (tasks: ParsedVoiceTask[]) => void;
}

const RECURRENCE_LABEL_MAP: Record<string, string> = {
  DAILY: "Quotidien",
  WEEKDAYS: "Lun - Ven",
  WEEKLY: "Hebdo",
  CUSTOM: "Perso",
  ONCE: "1 fois",
};

const CATEGORY_COLORS: Record<string, string> = {
  Sport: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Santé: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Travail: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Apprentissage: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  General: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

export const VoiceActionModal: React.FC<VoiceActionModalProps> = ({
  isOpen,
  selectedDate,
  onClose,
  onAddTasks,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedTasks, setParsedTasks] = useState<ParsedVoiceTask[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const recognitionRef = useRef<any>(null);

  // Check browser permissions on mount / open
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript("");
      setParsedTasks([]);
      return;
    }

    checkMicrophonePermission();
  }, [isOpen]);

  const checkMicrophonePermission = async () => {
    if (typeof window === "undefined") return;

    // Check Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPermissionStatus("unsupported");
      return;
    }

    // Check Navigator Permissions API if available
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        setPermissionStatus(status.state as any);

        status.onchange = () => {
          setPermissionStatus(status.state as any);
        };

        if (status.state === "granted") {
          startListening();
        }
      } catch {
        // Fallback: try starting directly
        startListening();
      }
    } else {
      startListening();
    }
  };

  const requestPermissionAndListen = async () => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop audio tracks immediately after permission check
        stream.getTracks().forEach((track) => track.stop());
        setPermissionStatus("granted");
        startListening();
      } catch (err: any) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionStatus("denied");
        }
        console.warn("Permission micro refusée:", err);
      }
    } else {
      startListening();
    }
  };

  // Update parsed tasks automatically as transcript evolves
  useEffect(() => {
    if (transcript.trim()) {
      const localParsed = parseVoiceTranscriptToTasks(transcript, selectedDate);
      setParsedTasks(localParsed);
    } else {
      setParsedTasks([]);
    }
  }, [transcript, selectedDate]);

  const startListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPermissionStatus("unsupported");
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "fr-FR";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setPermissionStatus("granted");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + " ";
        }
        setTranscript(currentTranscript.trim());
      };

      recognition.onerror = (event: any) => {
        console.warn("Erreur reconnaissance vocale:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setPermissionStatus("denied");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Impossible de démarrer la reconnaissance vocale:", e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (permissionStatus === "denied" || permissionStatus === "prompt") {
      requestPermissionAndListen();
    } else if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleRemoveTask = (index: number) => {
    setParsedTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmAdd = () => {
    if (parsedTasks.length === 0) return;

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#D4F63D", "#34D399", "#FFFFFF"],
    });

    onAddTasks(parsedTasks);
    onClose();
  };

  const handleExamplePrompt = (prompt: string) => {
    setTranscript(prompt);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#16181D] border border-[#282B35] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#252832]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4F63D] text-black flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Ajout Vocal d'Actions</h3>
              <p className="text-[11px] text-[#8E929E]">Parle naturellement pour ajouter 1 ou plusieurs tâches</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8E929E] hover:text-white rounded-full hover:bg-[#252832] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Denied Banner */}
        {permissionStatus === "denied" && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-3.5 space-y-2 text-xs text-red-200">
            <div className="flex items-center gap-2 font-bold text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Accès au micro refusé par le navigateur</span>
            </div>
            <p className="text-[11px] text-red-200/80 leading-relaxed">
              Pour activer la voix, clique sur l'icône <Lock className="w-3 h-3 inline mx-0.5" /> à gauche de l'URL dans la barre de ton navigateur et autorise le <strong>Microphone</strong>.
            </p>
          </div>
        )}

        {/* Permission Unsupported Banner */}
        {permissionStatus === "unsupported" && (
          <div className="bg-[#202228] border border-[#323642] rounded-2xl p-3 text-xs text-[#9CA3AF]">
            <span>Reconnaissance vocale non supportée par ce navigateur. Tu peux taper ou coller tes actions ci-dessous :</span>
          </div>
        )}

        {/* Microphone Center Control */}
        <div className="flex flex-col items-center justify-center py-4 space-y-3 bg-[#111214] rounded-2xl border border-[#22252E] p-4 relative overflow-hidden">
          {/* Animated Wave Glow while listening */}
          {isListening && (
            <div className="absolute inset-0 bg-radial from-[#D4F63D]/10 to-transparent animate-pulse pointer-events-none" />
          )}

          <button
            type="button"
            onClick={toggleListening}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer relative",
              isListening
                ? "bg-[#D4F63D] text-black ring-8 ring-[#D4F63D]/20 scale-110"
                : permissionStatus === "denied"
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "bg-[#252830] text-[#D4F63D] hover:bg-[#323640] border border-[#3A3F4D]"
            )}
          >
            {isListening ? (
              <Mic className="w-7 h-7 animate-pulse stroke-[2.5]" />
            ) : (
              <MicOff className="w-7 h-7 text-[#8E929E]" />
            )}
          </button>

          <span className="text-xs font-bold text-white">
            {isListening
              ? "À l'écoute... (parle maintenant)"
              : permissionStatus === "denied"
              ? "Microphone bloqué — Débloque dans le navigateur"
              : "Micro en pause — Clique pour parler"}
          </span>

          {/* Transcript input / editable preview */}
          <div className="w-full">
            <textarea
              rows={2}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Ex: Nouvelle tâche mardi prochain envoyer un email à Laurent. Nouvelle tâche tous les mercredis cours de danse à 17h..."
              className="w-full bg-[#1C1E24] border border-[#2B2E38] rounded-xl p-2.5 text-xs text-white placeholder-[#6B7280] focus:border-[#D4F63D] outline-none resize-none"
            />
          </div>
        </div>

        {/* Quick Example Voice Chips if empty */}
        {!transcript && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[#8E929E] uppercase tracking-wider">
              Exemples à tester :
            </span>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleExamplePrompt(
                    "Nouvelle tâche mardi prochain envoyer un email à Laurent Nouvelle tâche tous les mercredis aller au cours de danse à 17h"
                  )
                }
                className="text-left text-xs bg-[#1C1E24] hover:bg-[#252830] p-2 rounded-xl text-[#D1D5DB] border border-[#282B33] transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>🎙️ "Mardi prochain envoyer email à Laurent + tous les mercredis danse à 17h"</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4F63D] flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() =>
                  handleExamplePrompt("Tous les jours faire 20 minutes de lecture à 21h")
                }
                className="text-left text-xs bg-[#1C1E24] hover:bg-[#252830] p-2 rounded-xl text-[#D1D5DB] border border-[#282B33] transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>🎙️ "Tous les jours faire 20 minutes de lecture à 21h"</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4F63D] flex-shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Parsed Tasks List */}
        {parsedTasks.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-2 max-h-56 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                {parsedTasks.length} action{parsedTasks.length > 1 ? "s" : ""} détectée{parsedTasks.length > 1 ? "s" : ""} :
              </span>
              <span className="text-[10px] text-[#D4F63D] font-mono font-bold">
                ✓ Prêtes à être ajoutées
              </span>
            </div>

            {parsedTasks.map((task, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#1C1E24] border border-[#2B2E38] rounded-2xl flex items-start justify-between gap-2 shadow-sm"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.2 rounded-md font-semibold border flex-shrink-0",
                        CATEGORY_COLORS[task.category] || CATEGORY_COLORS.General
                      )}
                    >
                      {task.category}
                    </span>
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                    <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-lg border border-[#252830]">
                      <Repeat className="w-3 h-3 text-[#6B7280]" />
                      <span>{RECURRENCE_LABEL_MAP[task.recurrence] || "1 fois"}</span>
                    </span>

                    {task.targetDate && (
                      <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-lg border border-[#252830] text-[#D4F63D]">
                        <Calendar className="w-3 h-3" />
                        <span>{task.targetDate}</span>
                      </span>
                    )}

                    {task.startTime && (
                      <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-lg border border-[#252830]">
                        <Clock className="w-3 h-3 text-[#60A5FA]" />
                        <span>
                          {task.startTime}
                          {task.endTime ? ` - ${task.endTime}` : ""}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveTask(idx)}
                  className="p-1 text-[#6B7280] hover:text-red-400 transition-colors rounded-lg hover:bg-[#252830]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 border-t border-[#252832]">
          <button
            type="button"
            disabled={parsedTasks.length === 0}
            onClick={handleConfirmAdd}
            className={cn(
              "w-full py-3.5 rounded-2xl font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer",
              parsedTasks.length > 0
                ? "bg-[#D4F63D] hover:bg-[#c2e432] text-black active:scale-98"
                : "bg-[#252830] text-[#6B7280] cursor-not-allowed"
            )}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {parsedTasks.length > 1
                ? `Ajouter les ${parsedTasks.length} actions (1 clic)`
                : parsedTasks.length === 1
                ? "Ajouter l'action"
                : "Parle pour détecter des actions"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
