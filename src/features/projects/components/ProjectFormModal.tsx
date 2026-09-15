"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, FolderPlus, Plus, Trash2, Columns3, CheckCircle2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project, ProjectColumn, getProjectColumns, generateColumnId } from "../types";

interface ProjectFormModalProps {
  isOpen: boolean;
  initialProject?: Project | null;
  onClose: () => void;
  onSubmit: (
    data: { name: string; color: string; columns: ProjectColumn[]; categories?: string[] },
    projectId?: string
  ) => void;
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
  const isEditing = Boolean(initialProject);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [columns, setColumns] = useState<ProjectColumn[]>(getProjectColumns({ columns: [] }));
  const [categories, setCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setConfirmDelete(false);
      setNewCatInput("");
      if (initialProject) {
        setName(initialProject.name);
        setColor(initialProject.color);
        setColumns(getProjectColumns(initialProject));
        setCategories(
          Array.isArray(initialProject.categories) ? [...initialProject.categories] : []
        );
      } else {
        setName("");
        setColor(COLOR_OPTIONS[0]);
        setColumns(getProjectColumns({ columns: [] }));
        setCategories([]);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialProject]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    let cleanColumns = columns.map((c) => ({ ...c, label: c.label.trim() })).filter((c) => c.label);
    if (!trimmed || cleanColumns.length === 0) return;

    // Guarantee there's always a "done" column that closes a task when it lands there
    if (!cleanColumns.some((c) => c.isDone)) {
      cleanColumns = cleanColumns.map((c, idx) =>
        idx === cleanColumns.length - 1 ? { ...c, isDone: true } : c
      );
    }

    const cleanCategories = categories.map((c) => c.trim()).filter(Boolean);

    onSubmit(
      {
        name: trimmed,
        color,
        columns: cleanColumns,
        categories: cleanCategories,
      },
      initialProject?.id
    );
    onClose();
  };

  const handleDelete = () => {
    if (initialProject && onDelete) {
      onDelete(initialProject.id);
      onClose();
    }
  };

  const addColumn = () => {
    setColumns((prev) => [...prev, { id: generateColumnId(), label: "" }]);
  };

  const renameColumn = (id: string, label: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  };

  const toggleDoneColumn = (id: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, isDone: !c.isDone } : c)));
  };

  const removeColumn = (id: string) => {
    setColumns((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-sm max-h-[88vh] bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-2xl relative flex flex-col space-y-4 my-auto overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#282A30] flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-[#D4F63D]" />
            <span>{isEditing ? "Modifier le projet" : "Nouveau projet"}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#252830] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0">
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
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
              <Columns3 className="w-3.5 h-3.5" />
              Colonnes du board
            </label>
            <div className="space-y-2">
              {columns.map((col) => (
                <div key={col.id} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Nom de la colonne"
                    value={col.label}
                    onChange={(e) => renameColumn(col.id, e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] text-white text-xs outline-none transition-all placeholder-[#6B7280]"
                  />
                  <button
                    type="button"
                    onClick={() => toggleDoneColumn(col.id)}
                    title="Marque la tâche comme terminée quand elle arrive dans cette colonne"
                    className={cn(
                      "flex items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-bold transition-colors flex-shrink-0 cursor-pointer border",
                      col.isDone
                        ? "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D]"
                        : "bg-transparent border-[#343740] text-[#6B7280] hover:text-[#9CA3AF] hover:border-[#4B5563]"
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeColumn(col.id)}
                    disabled={columns.length <= 1}
                    className={cn(
                      "p-2 rounded-lg transition-colors flex-shrink-0",
                      columns.length > 1
                        ? "text-[#8E929E] hover:text-red-400 hover:bg-[#252830] cursor-pointer"
                        : "text-[#4B5563] cursor-not-allowed opacity-40"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#6B7280] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#D4F63D]" />
              Marque une colonne comme &quot;Fait&quot; pour qu&apos;y déposer une tâche la valide automatiquement
            </p>
            <button
              type="button"
              onClick={addColumn}
              className="w-full mt-1 py-2 rounded-xl border border-dashed border-[#4B5563] text-[#8E929E] hover:border-[#D4F63D] hover:text-[#D4F63D] transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une colonne
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-sm transition-all cursor-pointer"
          >
            {isEditing ? "Enregistrer" : "Créer le projet"}
          </button>

          {isEditing && onDelete && (
            <div className="pt-2 border-t border-[#282A30]">
              {confirmDelete ? (
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2">
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
