"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  Sliders,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  PieChart,
  Moon,
  Flame,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardModuleConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export const DEFAULT_DASHBOARD_MODULES: DashboardModuleConfig[] = [
  {
    id: "METRICS",
    label: "Complétion",
    description: "Pourcentage de réussite de la période",
    enabled: true,
  },
  {
    id: "PROJECT_STATS",
    label: "Statistiques des Projets",
    description: "Camembert et répartition des tâches par projet",
    enabled: true,
  },
  {
    id: "SLEEP_WAVE",
    label: "Suivi du Sommeil",
    description: "Courbe d'onde et analyse du temps de sommeil",
    enabled: true,
  },
  {
    id: "HABITS_VIEW",
    label: "Habitudes & Séries",
    description: "Calendrier mensuel ou matrice des 7 derniers jours",
    enabled: true,
  },
];

const MODULE_ICONS: Record<string, React.ReactNode> = {
  METRICS: <Target className="w-4 h-4 text-[#60A5FA]" />,
  PROJECT_STATS: <PieChart className="w-4 h-4 text-[#A78BFA]" />,
  SLEEP_WAVE: <Moon className="w-4 h-4 text-[#38BDF8]" />,
  HABITS_VIEW: <Flame className="w-4 h-4 text-[#F59E0B]" />,
};

function SortableModuleItem({
  module,
  onToggle,
}: {
  module: DashboardModuleConfig;
  onToggle: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all select-none",
        isDragging
          ? "bg-[#252830] border-[#D4F63D] shadow-2xl z-30 opacity-95 scale-102"
          : module.enabled
          ? "bg-[#1C1D22] border-[#282A30] hover:border-[#383C48]"
          : "bg-[#16171C]/50 border-[#202228] opacity-60"
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="p-1.5 -ml-1 text-[#6B7280] hover:text-[#D4F63D] cursor-grab active:cursor-grabbing rounded-lg hover:bg-white/5 touch-none flex-shrink-0"
        title="Glisser pour réorganiser"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Module info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="p-2 rounded-xl bg-white/5 flex-shrink-0">
          {MODULE_ICONS[module.id] || <Sliders className="w-4 h-4 text-[#8E929E]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-bold text-white truncate">
            {module.label}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#8E929E] truncate">
            {module.description}
          </div>
        </div>
      </div>

      {/* Toggle visibility */}
      <button
        type="button"
        onClick={() => onToggle(module.id)}
        className={cn(
          "px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0",
          module.enabled
            ? "bg-[#D4F63D]/15 text-[#D4F63D] border border-[#D4F63D]/30"
            : "bg-[#202228] text-[#6B7280] border border-transparent hover:text-white"
        )}
      >
        {module.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{module.enabled ? "Actif" : "Masqué"}</span>
      </button>
    </div>
  );
}

interface DashboardConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: DashboardModuleConfig[];
  onSave: (modules: DashboardModuleConfig[]) => void;
}

export const DashboardConfigModal: React.FC<DashboardConfigModalProps> = ({
  isOpen,
  onClose,
  modules: initialModules,
  onSave,
}) => {
  const [modules, setModules] = useState<DashboardModuleConfig[]>(initialModules);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  if (!isOpen) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setModules((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleToggle = (id: string) => {
    setModules((items) =>
      items.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleReset = () => {
    setModules(DEFAULT_DASHBOARD_MODULES);
  };

  const handleApply = () => {
    onSave(modules);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="modal-adaptive-card w-full max-w-md max-h-[90vh] flex flex-col bg-[#16171C] border border-[#282A30] rounded-3xl p-5 shadow-2xl relative space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#282A30] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#D4F63D]/10 text-[#D4F63D]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Personnaliser le Dashboard</h2>
              <p className="text-[11px] text-[#8E929E]">
                Glisse pour réordonner, clique pour activer/masquer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#202228] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sortable List */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 py-1 flex-1 overflow-y-auto overscroll-contain pr-1">
              {modules.map((mod) => (
                <SortableModuleItem key={mod.id} module={mod} onToggle={handleToggle} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#282A30] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-[#202228] hover:bg-[#282A30] text-[#8E929E] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-[#202228] hover:bg-[#282A30] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
