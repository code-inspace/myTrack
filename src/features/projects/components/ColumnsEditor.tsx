"use client";

import React, { useState } from "react";
import { Plus, Trash2, Columns3, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectColumn, generateColumnId } from "../types";

interface ColumnsEditorProps {
  columns: ProjectColumn[];
  onChange: (columns: ProjectColumn[]) => void;
  /** Called when a column name loses focus (lets forms autosave once typing is done). */
  onCommit?: () => void;
  title?: string;
}

/** Board columns editor (rename, "done" flag, add, delete) shared by projects and the all-projects board. */
export const ColumnsEditor: React.FC<ColumnsEditorProps> = ({
  columns,
  onChange,
  onCommit,
  title = "Colonnes du board",
}) => {
  const [columnToDeleteId, setColumnToDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
        <Columns3 className="w-3.5 h-3.5" />
        {title}
      </label>
      <div className="space-y-2">
        {columns.map((col) => {
          const isConfirmingDelete = columnToDeleteId === col.id;

          if (isConfirmingDelete) {
            return (
              <div
                key={col.id}
                className="flex items-center justify-between p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-xs animate-in fade-in"
              >
                <span className="text-red-300 font-medium truncate pr-2">
                  Supprimer la colonne &laquo;&nbsp;{col.label || "Sans titre"}&nbsp;&raquo; ?
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(columns.length > 1 ? columns.filter((c) => c.id !== col.id) : columns);
                      setColumnToDeleteId(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumnToDeleteId(null)}
                    className="px-2 py-1 rounded-lg bg-[#252830] hover:bg-[#343740] text-[#8E929E] hover:text-white text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={col.id} className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Nom de la colonne"
                value={col.label}
                onChange={(e) => onChange(columns.map((c) => (c.id === col.id ? { ...c, label: e.target.value } : c)))}
                onBlur={() => onCommit?.()}
                className="flex-1 px-3 py-2 rounded-xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] text-white text-xs outline-none transition-all placeholder-[#6B7280]"
              />
              <button
                type="button"
                onClick={() => onChange(columns.map((c) => (c.id === col.id ? { ...c, isDone: !c.isDone } : c)))}
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
                onClick={() => setColumnToDeleteId(col.id)}
                disabled={columns.length <= 1}
                title="Supprimer la colonne"
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
          );
        })}
      </div>
      <p className="text-[10px] text-[#6B7280] flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-[#D4F63D]" />
        Marque une colonne comme &quot;Fait&quot; pour qu&apos;y déposer une tâche la valide automatiquement
      </p>
      <button
        type="button"
        onClick={() => onChange([...columns, { id: generateColumnId(), label: "" }])}
        className="w-full mt-1 py-2 rounded-xl border border-dashed border-[#4B5563] text-[#8E929E] hover:border-[#D4F63D] hover:text-[#D4F63D] transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Ajouter une colonne
      </button>
    </div>
  );
};
