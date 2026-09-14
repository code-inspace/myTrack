"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  Upload,
  Sparkles,
  X,
  Check,
  Plus,
  Trash2,
  Clock,
  Tag,
  AlertCircle,
  RefreshCw,
  FileImage,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExtractedPhotoTask } from "@/app/api/tasks/import-photo/route";

interface PhotoTaskImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onImportTasks: (tasks: ExtractedPhotoTask[]) => void;
}

interface EditableTask extends ExtractedPhotoTask {
  id: string;
  selected: boolean;
}

const CATEGORIES = ["General", "Sport", "Santé", "Travail", "Apprentissage"] as const;

export const PhotoTaskImportModal: React.FC<PhotoTaskImportModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onImportTasks,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedTasks, setDetectedTasks] = useState<EditableTask[]>([]);
  const [step, setStep] = useState<"capture" | "review">("capture");
  const [targetDate, setTargetDate] = useState<string>(selectedDate);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setImageSrc(null);
    setIsAnalyzing(false);
    setErrorMessage(null);
    setDetectedTasks([]);
    setStep("capture");
    setTargetDate(selectedDate);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Veuillez sélectionner un fichier image valide (JPG, PNG, HEIC).");
      return;
    }
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageSrc(result);
      analyzePhoto(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const analyzePhoto = async (base64Image: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tasks/import-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          referenceDate: targetDate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Impossible d'analyser la photo");
      }

      const tasks: ExtractedPhotoTask[] = data.tasks || [];
      if (tasks.length === 0) {
        setErrorMessage("Aucune tâche n'a pu être détectée sur cette photo. Essayez avec un meilleur éclairage ou une photo plus nette.");
        setStep("capture");
      } else {
        setDetectedTasks(
          tasks.map((t, idx) => ({
            ...t,
            id: `detected-${Date.now()}-${idx}`,
            selected: true,
            targetDate: t.targetDate || targetDate,
          }))
        );
        setStep("review");
      }
    } catch (err: any) {
      console.error("[PhotoTaskImportModal] Analysis error:", err);
      setErrorMessage(err.message || "Erreur lors de l'analyse par l'IA");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleTaskSelection = (id: string) => {
    setDetectedTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const updateTaskField = (id: string, field: keyof EditableTask, value: any) => {
    setDetectedTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const removeTask = (id: string) => {
    setDetectedTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const addNewTask = () => {
    const newTask: EditableTask = {
      id: `manual-${Date.now()}`,
      title: "",
      category: "General",
      startTime: null,
      endTime: null,
      targetDate: targetDate,
      selected: true,
      isCompleted: false,
    };
    setDetectedTasks((prev) => [...prev, newTask]);
  };

  const handleConfirmImport = () => {
    const selected = detectedTasks.filter((t) => t.selected && t.title.trim().length > 0);
    if (selected.length === 0) return;

    onImportTasks(
      selected.map((t) => ({
        title: t.title.trim(),
        description: t.description,
        category: t.category || "General",
        startTime: t.startTime,
        endTime: t.endTime,
        targetDate: targetDate,
        isCompleted: t.isCompleted,
      }))
    );

    handleClose();
  };

  const selectedCount = detectedTasks.filter((t) => t.selected && t.title.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-[#141518] border border-[#262832] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#23252E] flex items-center justify-between bg-[#191A20] select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D4F63D]/15 text-[#D4F63D] flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Scanner une liste papier</span>
                <span className="text-[10px] bg-[#D4F63D]/20 text-[#D4F63D] px-2 py-0.5 rounded-full font-bold">
                  IA Vision
                </span>
              </h2>
              <p className="text-xs text-[#8E929E]">
                Importe instantanément tes notes et to-do lists manuscrites
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-[#22242B] hover:bg-[#2C2E38] text-[#8E929E] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#FCA5A5] text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === "capture" && !isAnalyzing && (
            <div className="space-y-4">
              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-6 rounded-3xl bg-[#1C1D24] hover:bg-[#242630] border-2 border-dashed border-[#343744] hover:border-[#D4F63D] transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer active:scale-98"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#D4F63D] text-[#111214] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Camera className="w-7 h-7 stroke-[2.3]" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-white block">Prendre une photo</span>
                    <span className="text-xs text-[#8E929E]">Appareil photo direct</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-6 rounded-3xl bg-[#1C1D24] hover:bg-[#242630] border-2 border-dashed border-[#343744] hover:border-[#D4F63D] transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer active:scale-98"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#262832] text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-[#D4F63D] group-hover:text-[#111214] transition-all">
                    <Upload className="w-7 h-7 stroke-[2.3]" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-white block">Depuis la galerie</span>
                    <span className="text-xs text-[#8E929E]">Fichier ou photo existante</span>
                  </div>
                </button>
              </div>

              {/* Pro Tips Box */}
              <div className="bg-[#191A20] border border-[#262832] rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#D4F63D]">
                  <Sparkles className="w-4 h-4" />
                  <span>Conseils pour une reconnaissance optimale</span>
                </div>
                <ul className="text-xs text-[#8E929E] space-y-1.5 list-disc list-inside">
                  <li>Pose ta feuille sur une surface plane bien éclairée.</li>
                  <li>Cadre bien l'ensemble de ta liste sans ombre forte.</li>
                  <li>L'IA reconnaît l'écriture manuscrite, les heures (ex: 14h) et les cases à cocher.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Loading / Scanning Animation State */}
          {isAnalyzing && (
            <div className="py-10 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative w-28 h-28 rounded-3xl bg-[#1C1D24] border-2 border-[#D4F63D]/40 flex items-center justify-center overflow-hidden shadow-2xl">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt="Aperçu de la note"
                    className="w-full h-full object-cover opacity-50 blur-[1px]"
                  />
                ) : (
                  <FileImage className="w-10 h-10 text-[#D4F63D]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#D4F63D]/25 to-transparent animate-pulse" />
                <div className="absolute inset-x-0 h-1 bg-[#D4F63D] shadow-[0_0_15px_#D4F63D] animate-bounce" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#D4F63D] animate-spin" />
                  <span>Analyse et transcription en cours...</span>
                </h3>
                <p className="text-xs text-[#8E929E]">
                  Extraction automatique de tes tâches manuscrites
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Review & Edit Extracted Tasks */}
          {step === "review" && !isAnalyzing && (
            <div className="space-y-3.5">
              {/* Target date picker bar */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1C1D22] border border-[#282A32]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#8E929E]">
                  <Calendar className="w-4 h-4 text-[#D4F63D]" />
                  <span>Ajouter au planning du :</span>
                </div>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-[#262832] border border-[#343744] text-white text-xs font-bold py-1.5 px-3 rounded-xl outline-none focus:border-[#D4F63D] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-[#8E929E] uppercase tracking-wider">
                  Tâches détectées ({detectedTasks.length})
                </span>
                <button
                  type="button"
                  onClick={addNewTask}
                  className="text-xs font-bold text-[#D4F63D] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une ligne</span>
                </button>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {detectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3 rounded-2xl border transition-all flex items-start gap-3",
                      task.selected
                        ? "bg-[#1C1D24] border-[#2E313D] shadow-sm"
                        : "bg-[#16171C] border-[#22242B] opacity-50"
                    )}
                  >
                    {/* Checkbox selector */}
                    <button
                      type="button"
                      onClick={() => toggleTaskSelection(task.id)}
                      className={cn(
                        "w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer transition-colors",
                        task.selected
                          ? "bg-[#D4F63D] border-[#D4F63D] text-[#111214]"
                          : "border-[#404352] bg-transparent"
                      )}
                    >
                      {task.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    {/* Task Title & Details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        type="text"
                        value={task.title}
                        placeholder="Titre de l'action..."
                        onChange={(e) => updateTaskField(task.id, "title", e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-white placeholder-[#6B7280] outline-none border-b border-transparent focus:border-[#D4F63D] transition-colors"
                      />

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Category dropdown */}
                        <div className="flex items-center gap-1 bg-[#242630] px-2.5 py-1 rounded-lg border border-[#343744]">
                          <Tag className="w-3 h-3 text-[#D4F63D]" />
                          <select
                            value={task.category || "General"}
                            onChange={(e) => updateTaskField(task.id, "category", e.target.value)}
                            className="bg-transparent text-xs text-white outline-none cursor-pointer"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c} className="bg-[#1C1D24] text-white">
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Start Time input */}
                        <div className="flex items-center gap-1 bg-[#242630] px-2 py-1 rounded-lg border border-[#343744]">
                          <Clock className="w-3 h-3 text-[#8E929E]" />
                          <input
                            type="time"
                            value={task.startTime || ""}
                            onChange={(e) => updateTaskField(task.id, "startTime", e.target.value || null)}
                            className="bg-transparent text-xs text-white outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#F87171] hover:bg-[#2A1D20] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Reprendre une photo button */}
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 rounded-xl bg-[#1C1D24] hover:bg-[#252832] border border-[#2E313D] text-xs font-semibold text-[#8E929E] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scanner une autre feuille</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === "review" && (
          <div className="px-5 py-4 border-t border-[#23252E] bg-[#191A20] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="py-2.5 px-4 rounded-2xl bg-[#22242B] hover:bg-[#2C2E38] text-xs font-bold text-[#8E929E] hover:text-white transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={handleConfirmImport}
              className={cn(
                "py-3 px-6 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-xl cursor-pointer active:scale-98",
                selectedCount > 0
                  ? "bg-[#D4F63D] hover:bg-[#c3e533] text-[#111214] shadow-[#D4F63D]/20"
                  : "bg-[#2A2C35] text-[#6B7280] cursor-not-allowed"
              )}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                Importer {selectedCount} tâche{selectedCount > 1 ? "s" : ""}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
