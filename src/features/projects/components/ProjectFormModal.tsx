"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, FolderPlus, Plus, Trash2, Tag, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project, ProjectColumn, getProjectColumns } from "../types";
import { ColumnsEditor } from "./ColumnsEditor";

interface ProjectFormModalProps {
  isOpen: boolean;
  initialProject?: Project | null;
  onClose: () => void;
  onSubmit: (
    data: { name: string; color: string; columns: ProjectColumn[]; categories?: string[] },
    projectId?: string
  ) => Promise<Project | void> | void;
  onDelete?: (projectId: string) => void;
}

const COLOR_OPTIONS = [
  "#D4F63D", // Lime signature
  "#EF4444", // Rouge vif
  "#FACC15", // Jaune éclatant
  "#3B82F6", // Bleu royal
  "#10B981", // Vert émeraude
  "#F97316", // Orange vif
  "#EC4899", // Rose fuchsia
  "#8B5CF6", // Violet électrique
  "#06B6D4", // Cyan
  "#F43F5E", // Rose framboise
  "#84CC16", // Vert citron
  "#64748B", // Ardoise / Anthracite
];

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  initialProject,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [columns, setColumns] = useState<ProjectColumn[]>(() => getProjectColumns({ columns: [] }));
  const [categories, setCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const prevIsOpenRef = useRef(false);
  const isSavingRef = useRef(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string>("");
  const activeProjectIdRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<any> | null>(null);
  const queuedSaveRef = useRef<boolean>(false);
  activeProjectIdRef.current = activeProjectId;

  const isEditing = Boolean(activeProjectId || initialProject);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      savePromiseRef.current = null;
      queuedSaveRef.current = false;
      isSavingRef.current = false;
      setConfirmDelete(false);
      setNewCatInput("");
      setSaveStatus("idle");
      if (initialProject) {
        setName(initialProject.name || "");
        setColor(initialProject.color || COLOR_OPTIONS[0]);
        const cols = getProjectColumns(initialProject);
        setColumns(cols);
        const cats = Array.isArray(initialProject.categories) ? [...initialProject.categories] : [];
        setCategories(cats);
        setActiveProjectId(initialProject.id);
        activeProjectIdRef.current = initialProject.id;
        lastSavedSignatureRef.current = JSON.stringify({
          name: (initialProject.name || "").trim(),
          color: initialProject.color || COLOR_OPTIONS[0],
          columns: cols,
          categories: cats,
        });
      } else {
        setName("");
        setColor(COLOR_OPTIONS[0]);
        const cols = getProjectColumns({ columns: [] });
        setColumns(cols);
        setCategories([]);
        setActiveProjectId(null);
        activeProjectIdRef.current = null;
        lastSavedSignatureRef.current = "";
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialProject]);

  const getCleanPayload = useCallback(() => {
    const trimmed = name.trim();
    let cleanColumns = columns.map((c) => ({ ...c, label: c.label.trim() })).filter((c) => c.label);
    if (cleanColumns.length === 0) {
      cleanColumns = getProjectColumns({ columns: [] });
    }
    if (!cleanColumns.some((c) => c.isDone)) {
      cleanColumns = cleanColumns.map((c, idx) =>
        idx === cleanColumns.length - 1 ? { ...c, isDone: true } : c
      );
    }
    const cleanCategories = categories.map((c) => c.trim()).filter(Boolean);
    return {
      name: trimmed,
      color,
      columns: cleanColumns,
      categories: cleanCategories,
    };
  }, [name, color, columns, categories]);

  const performSave = useCallback(async (): Promise<any> => {
    if (savePromiseRef.current) {
      queuedSaveRef.current = true;
      return savePromiseRef.current;
    }

    const payload = getCleanPayload();
    if (!payload.name) return;

    const signature = JSON.stringify(payload);
    if (signature === lastSavedSignatureRef.current) return;

    setSaveStatus("saving");
    isSavingRef.current = true;

    const doSave = async () => {
      try {
        const currentId = activeProjectIdRef.current;
        if (currentId) {
          await onSubmit(payload, currentId);
          lastSavedSignatureRef.current = signature;
          setSaveStatus("saved");
        } else {
          const result = await onSubmit(payload);
          if (result && typeof result === "object" && (result as any).id) {
            const newId = (result as any).id;
            setActiveProjectId(newId);
            activeProjectIdRef.current = newId;
          }
          lastSavedSignatureRef.current = signature;
          setSaveStatus("saved");
        }
      } catch (err) {
        console.error("Auto-save project error:", err);
        setSaveStatus("idle");
      } finally {
        isSavingRef.current = false;
        savePromiseRef.current = null;
        if (queuedSaveRef.current) {
          queuedSaveRef.current = false;
          performSave();
        }
      }
    };

    const promise = doSave();
    savePromiseRef.current = promise;
    return promise;
  }, [getCleanPayload, onSubmit]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setSaveStatus("idle");
      return;
    }

    const payload = getCleanPayload();
    const signature = JSON.stringify(payload);
    if (signature === lastSavedSignatureRef.current) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 450);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [isOpen, name, color, columns, categories, getCleanPayload, performSave]);

  const handleClose = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    performSave();
    onClose();
  };

  // Keyboard shortcut (Escape to close & flush)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!isOpen) return null;

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
    }
    setNewCatInput("");
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories((prev) => prev.filter((c) => c !== catToRemove));
  };

  const handleDelete = () => {
    const targetId = activeProjectId || initialProject?.id;
    if (targetId && onDelete) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      onDelete(targetId);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-sm max-h-[88vh] bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-2xl relative flex flex-col space-y-4 my-auto overflow-hidden modal-adaptive-card">
        {/* Modal Header with Auto-save indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-[#282A30] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-[#D4F63D]" />
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {isEditing ? "Modifier le projet" : "Nouveau projet"}
              </h2>
              {/* Auto-save status feedback */}
              <div className="flex items-center gap-1.5 mt-0.5">
                {saveStatus === "saving" ? (
                  <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Enregistrement...
                  </span>
                ) : saveStatus === "saved" ? (
                  <span className="text-[11px] text-[#D4F63D] font-medium flex items-center gap-1">
                    <Check className="w-3 h-3 text-[#D4F63D]" />
                    Enregistré
                  </span>
                ) : (
                  <span className="text-[10px] text-[#8E929E]">
                    Enregistrement automatique
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#252830] transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 pb-12 overscroll-contain">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
              Nom du projet *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="ex: Refonte site web"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => performSave()}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] text-white text-sm outline-none transition-all placeholder-[#6B7280]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
              Couleur
            </label>
            <div className="flex flex-wrap items-center gap-2.5 p-2 rounded-2xl bg-[#252830] border border-[#343740]">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all cursor-pointer hover:scale-110",
                    color === c ? "ring-2 ring-offset-2 ring-offset-[#252830] ring-white scale-110 shadow-lg" : "opacity-85 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Categories Management Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
                <Tag className="w-3.5 h-3.5 text-[#D4F63D]" />
                <span>Sous-catégories ({categories.length})</span>
              </label>
              <span className="text-[10px] text-[#6B7280]">Optionnel</span>
            </div>

            {/* Category badges list */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-[#252830] border border-[#343740]">
                {categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1C1D22] text-white text-xs font-medium border border-[#383C48] shadow-sm animate-in fade-in"
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate max-w-[150px]">{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-[#8E929E] hover:text-red-400 p-0.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                      title={`Supprimer ${cat}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add category input */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Ajouter une catégorie (ex: Design, Dev)..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                className="flex-1 px-3 py-2 rounded-xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] text-white text-xs outline-none transition-all placeholder-[#6B7280]"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3 py-2 rounded-xl bg-[#343740] hover:bg-[#D4F63D] hover:text-black text-white font-bold text-xs transition-all flex items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>
          </div>

          {/* Board Columns Section */}
          <ColumnsEditor columns={columns} onChange={setColumns} onCommit={() => performSave()} />

          {/* Delete Project Section (When editing an existing project) */}
          {isEditing && onDelete && (
            <div className="pt-3 border-t border-[#282A30]">
              {confirmDelete ? (
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2 animate-in fade-in">
                  <p className="text-xs text-red-300 font-medium">
                    Supprimer ce projet ? Toutes les tâches associées seront désaffectées et conservées.
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
                      className="px-3 py-2 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#8E929E] hover:text-white text-xs font-semibold transition-all cursor-pointer"
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
                  <span>Supprimer ce projet</span>
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

