"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sparkles, X, Check, Clock, Repeat, Calendar, Trash2, ArrowRight, AlertCircle, Lock, Volume2, CheckCircle2, HelpCircle } from "lucide-react";
import { TaskFormValues, Task } from "@/features/tasks/types";
import { parseVoiceTranscriptToActions, findBestMatchingTask } from "../parser";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ParsedVoiceTask extends TaskFormValues {
  targetDate?: string;
}

type ResolvedAction =
  | { kind: "create"; task: ParsedVoiceTask }
  | { kind: "complete"; query: string; matchedTask: Task | null };

interface VoiceActionModalProps {
  isOpen: boolean;
  selectedDate: string;
  /** Existing tasks, used to resolve "ferme/termine la tâche X" voice commands. */
  allTasks: Task[];
  onClose: () => void;
  onAddTasks: (tasks: ParsedVoiceTask[]) => void;
  /** Marks each of these existing tasks as done (from a "close task" voice command). */
  onCompleteTasks: (taskIds: string[]) => void;
}

const RECURRENCE_LABEL_MAP: Record<string, string> = {
  DAILY: "Quotidien",
  WEEKDAYS: "Lun - Ven",
  WEEKLY: "Hebdo",
  CUSTOM: "Perso",
  ONCE: "1 fois",
};

const TAG_COLORS: Record<string, string> = {
  Fitness: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Sport: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Health: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Santé: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Productivity: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Travail: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Learning: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Apprentissage: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Mindfulness: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  General: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

export const VoiceActionModal: React.FC<VoiceActionModalProps> = ({
  isOpen,
  selectedDate,
  allTasks,
  onClose,
  onAddTasks,
  onCompleteTasks,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [resolvedActions, setResolvedActions] = useState<ResolvedAction[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Check support on open
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript("");
      setResolvedActions([]);
      setErrorMessage(null);
      return;
    }

    if (typeof window !== "undefined") {
      const hasSpeechRec = Boolean(
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      );
      if (!hasSpeechRec) {
        setPermissionStatus("unsupported");
      }
    }
  }, [isOpen]);

  // Update parsed/resolved actions automatically as transcript evolves
  useEffect(() => {
    if (transcript.trim()) {
      const actions = parseVoiceTranscriptToActions(transcript, selectedDate);
      const resolved: ResolvedAction[] = actions.map((action) =>
        action.kind === "create"
          ? { kind: "create", task: action.task }
          : { kind: "complete", query: action.query, matchedTask: findBestMatchingTask(action.query, allTasks) }
      );
      setResolvedActions(resolved);
    } else {
      setResolvedActions([]);
    }
  }, [transcript, selectedDate, allTasks]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const startListening = async (isRetryOneShot = false) => {
    setErrorMessage(null);
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPermissionStatus("unsupported");
      return;
    }

    // 1. Request microphone via getUserMedia to trigger native browser prompt if needed
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setPermissionStatus("granted");
      } catch (err: any) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionStatus("denied");
          setErrorMessage("Accès micro refusé. Clique sur le cadenas 🔒 dans la barre d'adresse pour autoriser le micro.");
          setIsListening(false);
          return;
        }
      }
    }

    // 2. Initialize and start SpeechRecognition instance
    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "fr-FR";
      // If continuous mode failed previously with network error, try one-shot mode (single utterance)
      recognition.continuous = !isRetryOneShot;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setPermissionStatus("granted");
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += res[0].transcript + " ";
          } else {
            interimStr += res[0].transcript;
          }
        }
        const fullText = (finalStr + interimStr).trim();
        if (fullText) {
          setTranscript(fullText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setPermissionStatus("denied");
          setErrorMessage("Microphone bloqué dans le navigateur.");
        } else if (event.error === "network") {
          if (!isRetryOneShot) {
            // Attempt automatic fallback with single-utterance (non-continuous)
            console.log("Retrying speech recognition in one-shot mode...");
            setTimeout(() => {
              startListening(true);
            }, 300);
            return;
          }
          setErrorMessage(
            "Service vocal Google non joignable (bloqueur/VPN). Tu peux dicter avec la touche micro de ton clavier (Fn / Win+H) ou saisir directement ton texte ci-dessous."
          );
          setTimeout(() => textareaRef.current?.focus(), 100);
        } else if (event.error !== "no-speech") {
          setErrorMessage(`Erreur micro (${event.error}). Tu peux taper ton texte ci-dessous.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (e: any) {
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
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleRemoveTask = (index: number) => {
    setResolvedActions((prev) => prev.filter((_, i) => i !== index));
  };

  // "Complete" actions with no matching task can't be confirmed
  const confirmableActions = resolvedActions.filter(
    (a) => a.kind === "create" || a.matchedTask !== null
  );

  const handleConfirmAdd = () => {
    if (confirmableActions.length === 0) return;

    const newTasks = confirmableActions
      .filter((a): a is { kind: "create"; task: ParsedVoiceTask } => a.kind === "create")
      .map((a) => a.task);
    const completeTaskIds = confirmableActions
      .filter((a): a is { kind: "complete"; query: string; matchedTask: Task } => a.kind === "complete" && a.matchedTask !== null)
      .map((a) => a.matchedTask.id);

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#D4F63D", "#34D399", "#FFFFFF"],
    });

    if (newTasks.length > 0) onAddTasks(newTasks);
    if (completeTaskIds.length > 0) onCompleteTasks(completeTaskIds);
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
            className="p-1.5 text-[#8E929E] hover:text-white rounded-full hover:bg-[#252832] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Denied Banner */}
        {permissionStatus === "denied" && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-3.5 space-y-2 text-xs text-red-200">
            <div className="flex items-center gap-2 font-bold text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Accès au micro non autorisé</span>
            </div>
            <p className="text-[11px] text-red-200/80 leading-relaxed">
              Pour parler sur PC/Mac, clique sur l'icône <Lock className="w-3 h-3 inline mx-0.5" /> à gauche de l'URL dans ton navigateur et active le <strong>Microphone</strong>.
            </p>
          </div>
        )}

        {/* Permission Unsupported Banner */}
        {permissionStatus === "unsupported" && (
          <div className="bg-[#202228] border border-[#323642] rounded-2xl p-3 text-xs text-[#9CA3AF]">
            <span>Reconnaissance vocale non supportée par ce navigateur. Tu peux taper ou coller tes actions ci-dessous :</span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && permissionStatus !== "denied" && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-2.5 text-xs text-amber-300">
            {errorMessage}
          </div>
        )}

        {/* Microphone Center Control */}
        <div className="flex flex-col items-center justify-center py-4 space-y-3 bg-[#111214] rounded-2xl border border-[#22252E] p-4 relative overflow-hidden">
          {/* Animated Wave Glow while listening */}
          {isListening && (
            <div className="absolute inset-0 bg-radial from-[#D4F63D]/15 to-transparent animate-pulse pointer-events-none" />
          )}

          <button
            type="button"
            onClick={toggleListening}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer relative",
              isListening
                ? "bg-[#D4F63D] text-black ring-8 ring-[#D4F63D]/20 scale-110"
                : permissionStatus === "denied"
                ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                : "bg-[#252830] text-[#D4F63D] hover:bg-[#323640] hover:scale-105 border border-[#3A3F4D]"
            )}
          >
            {isListening ? (
              <Mic className="w-7 h-7 animate-pulse stroke-[2.5]" />
            ) : (
              <MicOff className="w-7 h-7 text-[#8E929E]" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleListening}
            className="text-xs font-bold text-white hover:text-[#D4F63D] transition-colors cursor-pointer"
          >
            {isListening
              ? "🔴 À l'écoute... (parle maintenant, clique pour stopper)"
              : permissionStatus === "denied"
              ? "⚠️ Micro bloqué — Clique pour réessayer"
              : "🎙️ Clique ici pour parler"}
          </button>

          {/* Transcript input / editable preview */}
          <div className="w-full">
            <textarea
              ref={textareaRef}
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
              Exemples rapides à tester :
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

        {/* Parsed Actions List */}
        {resolvedActions.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-2 max-h-56 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                {resolvedActions.length} action{resolvedActions.length > 1 ? "s" : ""} détectée{resolvedActions.length > 1 ? "s" : ""} :
              </span>
              <span className="text-[10px] text-[#D4F63D] font-mono font-bold">
                {confirmableActions.length === resolvedActions.length
                  ? "✓ Prêtes à être ajoutées"
                  : `${confirmableActions.length}/${resolvedActions.length} prêtes`}
              </span>
            </div>

            {resolvedActions.map((action, idx) =>
              action.kind === "complete" ? (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-2xl flex items-start justify-between gap-2 shadow-sm border",
                    action.matchedTask
                      ? "bg-[#1C1E24] border-[#2B2E38]"
                      : "bg-amber-500/10 border-amber-500/30"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {action.matchedTask ? (
                      <CheckCircle2 className="w-4 h-4 text-[#34D399] flex-shrink-0" />
                    ) : (
                      <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white truncate block">
                        {action.matchedTask
                          ? `Terminer : ${action.matchedTask.title}`
                          : `Aucune tâche trouvée pour « ${action.query} »`}
                      </span>
                      <span className="text-[10px] text-[#8E929E]">Marquer comme terminée</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTask(idx)}
                    className="p-1 text-[#6B7280] hover:text-red-400 transition-colors rounded-lg hover:bg-[#252830] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  key={idx}
                  className="p-3 bg-[#1C1E24] border border-[#2B2E38] rounded-2xl flex items-start justify-between gap-2 shadow-sm"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {action.task.title}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.2 rounded-md font-semibold border flex-shrink-0",
                          TAG_COLORS[action.task.tag || action.task.category] || TAG_COLORS.General
                        )}
                      >
                        {action.task.tag || action.task.category}
                      </span>
                    </div>

                    {/* Metadata Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                      <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-lg border border-[#252830]">
                        <Repeat className="w-3 h-3 text-[#6B7280]" />
                        <span>{RECURRENCE_LABEL_MAP[action.task.recurrence] || "1 fois"}</span>
                      </span>

                      {action.task.targetDate && (
                        <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-lg border border-[#252830] text-[#D4F63D]">
                          <Calendar className="w-3 h-3" />
                          <span>{action.task.targetDate}</span>
                        </span>
                      )}

                      {action.task.startTime && (
                        <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-lg border border-[#252830]">
                          <Clock className="w-3 h-3 text-[#60A5FA]" />
                          <span>
                            {action.task.startTime}
                            {action.task.endTime ? ` - ${action.task.endTime}` : ""}
                          </span>
                        </span>
                      )}

                      {action.task.enableReminders && (
                        <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-0.5 rounded-lg border border-[#252830] text-[#D4F63D]">
                          <Volume2 className="w-3 h-3" />
                          <span>Rappel</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTask(idx)}
                    className="p-1 text-[#6B7280] hover:text-red-400 transition-colors rounded-lg hover:bg-[#252830] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 border-t border-[#252832]">
          <button
            type="button"
            disabled={confirmableActions.length === 0}
            onClick={handleConfirmAdd}
            className={cn(
              "w-full py-3.5 rounded-2xl font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer",
              confirmableActions.length > 0
                ? "bg-[#D4F63D] hover:bg-[#c2e432] text-black active:scale-98"
                : "bg-[#252830] text-[#6B7280] cursor-not-allowed"
            )}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {confirmableActions.length > 1
                ? `Valider les ${confirmableActions.length} actions (1 clic)`
                : confirmableActions.length === 1
                ? "Valider l'action"
                : "Parle pour détecter des actions"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
