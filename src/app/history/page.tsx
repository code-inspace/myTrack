"use client";

import React from "react";
import { HistoryView } from "@/features/history/components/HistoryView";

export default function HistoryPage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0E0F12]">
      <HistoryView />
    </div>
  );
}
