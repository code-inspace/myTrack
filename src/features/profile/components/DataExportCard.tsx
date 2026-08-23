"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, Check, Database } from "lucide-react";
import { fetchTasks, fetchCompletions } from "@/features/tasks/actions";
import { generateTasksCSV, generateCompletionsCSV, downloadCSV } from "@/lib/csv/exporter";
import { useAuth } from "@/providers/AuthProvider";

export const DataExportCard: React.FC = () => {
  const { user } = useAuth();
  const [downloadedItem, setDownloadedItem] = useState<string | null>(null);

  const handleExportTasks = async () => {
    const tasks = await fetchTasks(user?.id);
    const csv = generateTasksCSV(tasks);
    downloadCSV("mytrack-taches.csv", csv);
    flashDownloaded("tasks");
  };

  const handleExportCompletions = async () => {
    const tasks = await fetchTasks(user?.id);
    const completions = await fetchCompletions(user?.id);
    const csv = generateCompletionsCSV(completions, tasks);
    downloadCSV("mytrack-accomplissements.csv", csv);
    flashDownloaded("completions");
  };

  const handleExportAll = async () => {
    const tasks = await fetchTasks(user?.id);
    const completions = await fetchCompletions(user?.id);
    const tasksCsv = generateTasksCSV(tasks);
    const compCsv = generateCompletionsCSV(completions, tasks);

    const combinedCsv = `=== MYTRACK TACHES ===\r\n${tasksCsv}\r\n\r\n=== MYTRACK ACCOMPLISSEMENTS ===\r\n${compCsv}`;
    downloadCSV("mytrack-sauvegarde-totale.csv", combinedCsv);
    flashDownloaded("all");
  };

  const flashDownloaded = (id: string) => {
    setDownloadedItem(id);
    setTimeout(() => setDownloadedItem(null), 2500);
  };

  return (
    <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-full bg-[#252830] flex items-center justify-center text-[#D4F63D]">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">Données & Export</h4>
          <p className="text-xs text-[#8E929E]">Exporter tout l'historique de la base au format standard CSV</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-2">
        {/* Ligne 1: Liste des tâches */}
        <button
          onClick={handleExportTasks}
          className="w-full p-3.5 rounded-2xl bg-[#252830] hover:bg-[#2F333E] border border-[#343740] text-left transition-all active:scale-[0.99] cursor-pointer flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1C1D22] border border-[#343740] flex items-center justify-center text-[#D4F63D]">
              <Database className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">1. Liste des tâches & habitudes</div>
              <div className="text-[11px] text-[#8E929E]">Export du paramétrage (taches.csv)</div>
            </div>
          </div>
          {downloadedItem === "tasks" ? (
            <div className="flex items-center gap-1 text-[#D4F63D] text-xs font-bold">
              <Check className="w-4 h-4" />
              <span>Téléchargé</span>
            </div>
          ) : (
            <Download className="w-4 h-4 text-[#8E929E]" />
          )}
        </button>

        {/* Ligne 2: Historique & Logs */}
        <button
          onClick={handleExportCompletions}
          className="w-full p-3.5 rounded-2xl bg-[#252830] hover:bg-[#2F333E] border border-[#343740] text-left transition-all active:scale-[0.99] cursor-pointer flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1C1D22] border border-[#343740] flex items-center justify-center text-[#D4F63D]">
              <Database className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">2. Historique & Validations</div>
              <div className="text-[11px] text-[#8E929E]">Tous les accomplissements datés (accomplissements.csv)</div>
            </div>
          </div>
          {downloadedItem === "completions" ? (
            <div className="flex items-center gap-1 text-[#D4F63D] text-xs font-bold">
              <Check className="w-4 h-4" />
              <span>Téléchargé</span>
            </div>
          ) : (
            <Download className="w-4 h-4 text-[#8E929E]" />
          )}
        </button>

        {/* Ligne 3: Sauvegarde complète */}
        <button
          onClick={handleExportAll}
          className="w-full p-3.5 rounded-2xl bg-[#252830] hover:bg-[#2F333E] border border-[#343740] text-left transition-all active:scale-[0.99] cursor-pointer flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1C1D22] border border-[#343740] flex items-center justify-center text-[#D4F63D]">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">3. Sauvegarde Complète (Tout-en-un)</div>
              <div className="text-[11px] text-[#8E929E]">Export combiné prêt pour réimport (sauvegarde.csv)</div>
            </div>
          </div>
          {downloadedItem === "all" ? (
            <div className="flex items-center gap-1 text-[#D4F63D] text-xs font-bold">
              <Check className="w-4 h-4" />
              <span>Téléchargé</span>
            </div>
          ) : (
            <Download className="w-4 h-4 text-[#8E929E]" />
          )}
        </button>
      </div>
    </div>
  );
};
