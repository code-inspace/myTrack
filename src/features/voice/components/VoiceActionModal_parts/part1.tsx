"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sparkles, X, Check, Clock, Repeat, Calendar, Trash2, ArrowRight, AlertCircle, Lock, Volume2 } from "lucide-react";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Check support on open
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript("");
      setParsedTasks([]);
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

  // Update parsed tasks automatically as transcript evolves
  useEffect(() => {
    if (transcript.trim()) {
      const localParsed = parseVoiceTranscriptToTasks(transcript, selectedDate);
      setParsedTasks(localParsed);
    } else {
      setParsedTasks([]);
    }
  }, [transcript, selectedDate]);

  const startListening = async () => {
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
      recognition.continuous = true;
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
          setErrorMessage("Erreur de connexion pour la reconnaissance vocale.");
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
