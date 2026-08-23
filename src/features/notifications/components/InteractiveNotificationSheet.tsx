"use client";

import React, { useState } from "react";
import { Bell, Check, X } from "lucide-react";
import confetti from "canvas-confetti";

interface InteractiveNotificationSheetProps {
  isOpen: boolean;
  question: string;
  taskTitle: string;
  onClose: () => void;
  onRespond: (action: "YES" | "NO" | "QUANTITY", value?: number) => void;
}

export const InteractiveNotificationSheet: React.FC<InteractiveNotificationSheetProps> = ({
  isOpen,
  question,
  taskTitle,
  onClose,
  onRespond,
}) => {
  if (!isOpen) return null;

  const handleYes = () => {
    confetti({
      particleCount: 30,
      spread: 60,
      colors: ["#D4F63D", "#ffffff"],
    });
    onRespond("YES");
    onClose();
  };

  const handleNo = () => {
    onRespond("NO");
    onClose();
  };

  const handleQuantity = (val: number) => {
    confetti({
      particleCount: 30,
      spread: 60,
      colors: ["#D4F63D", "#ffffff"],
    });
    onRespond("QUANTITY", val);
    onClose();
  };

  return (
    <div className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-[#1C1D22] border-2 border-[#D4F63D]/40 rounded-3xl p-5 shadow-2xl lime-glow">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#282A30]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#D4F63D] text-black flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide uppercase">
              Rappel MyTrack
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-1 rounded-full bg-[#252830]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Question Content */}
        <div className="my-3.5">
          <p className="text-sm font-bold text-white leading-snug">
            {question || `As-tu terminé ta session de ${taskTitle} ?`}
          </p>
          <p className="text-xs text-[#8E929E] mt-1">
            Touche une action pour enregistrer directement ta progression
          </p>
        </div>

        {/* Interactive Action Buttons (OUI / NON / Quantité) */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={handleYes}
            className="py-2.5 px-4 rounded-xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            OUI
          </button>

          <button
            onClick={handleNo}
            className="py-2.5 px-4 rounded-xl bg-[#252830] hover:bg-[#343740] active:scale-95 text-[#D1D5DB] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
            NON
          </button>
        </div>

        {/* Quick quantitative chips */}
        <div className="flex items-center justify-between gap-1.5 mt-3 pt-3 border-t border-[#282A30]">
          <span className="text-[11px] font-semibold text-[#8E929E]">Compte rapide :</span>
          <div className="flex gap-1.5">
            {[25, 50, 100].map((num) => (
              <button
                key={num}
                onClick={() => handleQuantity(num)}
                className="px-2.5 py-1 rounded-lg bg-[#252830] hover:bg-[#343740] text-[11px] font-bold text-[#D4F63D] cursor-pointer"
              >
                +{num}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
