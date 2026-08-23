"use client";

import React from "react";
import { AgendaView } from "@/features/agenda/components/AgendaView";

export default function AgendaPage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0E0F12]">
      <AgendaView />
    </div>
  );
}
