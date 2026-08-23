"use client";

import React from "react";
import { Logo } from "@/components/shared/Logo";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] space-y-4 select-none">
      <div className="animate-pulse">
        <Logo size="lg" showText={false} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-white tracking-tight">
          My<span className="text-[#D4F63D]">Track</span>
        </p>
        <p className="text-xs text-[#8E929E] font-medium animate-pulse">
          Chargement en cours...
        </p>
      </div>
    </div>
  );
}
