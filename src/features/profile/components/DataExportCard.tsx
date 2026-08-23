"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, Check, Database } from "lucide-react";
import { getStoredTasks, getStoredCompletions } from "@/features/tasks/actions";
import { generateTasksCSV, generateCompletionsCSV, downloadCSV } from "@/lib/csv/exporter";

export const DataExportCard: React.FC = () => {
  const [downloadedItem, setDownloadedItem] = useState<string | null>(null);

  const handleExportTasks = () => {
    const tasks = getStoredTasks();
    const csv = generateTasksCSV(tasks);
    downloadCSV("mytrack-tasks.csv", csv);
    flashDownloaded("tasks");
  };

  const handleExportCompletions = () => {
    const tasks = getStoredTasks();
    const completions = getStoredCompletions();
    const csv = generateCompletionsCSV(completions, tasks);
    downloadCSV("mytrack-completions.csv", csv);
    flashDownloaded("completions");
  };

  const handleExportAll = () => {
    const tasks = getStoredTasks();
    const completions = getStoredCompletions();
    const tasksCsv = generateTasksCSV(tasks);
    const compCsv = generateCompletionsCSV(completions, tasks);

    const combinedCsv = `=== MYTRACK TASKS ===\r\n${tasksCsv}\r\n\r\n=== MYTRACK COMPLETIONS ===\r\n${compCsv}`;
    downloadCSV("mytrack-all-data.csv", combinedCsv);
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
          <h4 className="text-sm font-bold text-white">Data & Export</h4>
          <p className="text-xs text-[#8E929E]">Export full history to standard CSV</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
        <button
          onClick={handleExportTasks}
          className="p-3 rounded-2xl bg-[#252830] hover:bg-[#343740] border border-[#343740] text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-white">Tasks List</div>
            <div className="text-[11px] text-[#8E929E]">tasks.csv</div>
          </div>
          {downloadedItem === "tasks" ? (
            <Check className="w-4 h-4 text-[#D4F63D]" />
          ) : (
            <Download className="w-4 h-4 text-[#8E929E]" />
          )}
        </button>

        <button
          onClick={handleExportCompletions}
          className="p-3 rounded-2xl bg-[#252830] hover:bg-[#343740] border border-[#343740] text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-white">History & Logs</div>
            <div className="text-[11px] text-[#8E929E]">completions.csv</div>
          </div>
          {downloadedItem === "completions" ? (
            <Check className="w-4 h-4 text-[#D4F63D]" />
          ) : (
            <Download className="w-4 h-4 text-[#8E929E]" />
          )}
        </button>

        <button
          onClick={handleExportAll}
          className="p-3 rounded-2xl bg-[#252830] hover:bg-[#343740] border border-[#343740] text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-white">Full Backup</div>
            <div className="text-[11px] text-[#8E929E]">all-data.csv</div>
          </div>
          {downloadedItem === "all" ? (
            <Check className="w-4 h-4 text-[#D4F63D]" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-[#D4F63D]" />
          )}
        </button>
      </div>
    </div>
  );
};
