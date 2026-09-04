"use client";

import React from "react";
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { Smartphone, ExternalLink, X, Sparkles, ShieldAlert } from "lucide-react";

interface LiveActivityPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveActivityPermissionModal: React.FC<LiveActivityPermissionModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleOpenSettings = async () => {
    await LiveActivityBridge.openSettings();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#17181F] border border-[#282B36] rounded-3xl p-6 shadow-2xl space-y-5 text-white animate-scaleUp">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4F63D]/15 border border-[#D4F63D]/30 flex items-center justify-center text-[#D4F63D]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                Activer la Dynamic Island
              </h3>
              <p className="text-xs text-[#8E929E] mt-0.5">
                Chronomètre &amp; suivi en direct sur votre iPhone
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#252830] text-[#8E929E] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info card */}
        <div className="p-4 rounded-2xl bg-[#111215] border border-[#22242D] space-y-2.5 text-xs text-[#C5C8D4] leading-relaxed">
          <div className="flex items-start gap-2 text-[#FBBF24]">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="font-semibold text-white">
              Les Activités en direct sont désactivées sur votre iPhone.
            </span>
          </div>

          <p>
            Pour afficher le chronomètre animé dans la <strong className="text-white">Dynamic Island</strong> et sur votre <strong className="text-white">écran de verrouillage</strong> :
          </p>

          <ol className="list-decimal pl-4 space-y-1 text-[#8E929E]">
            <li>Touchez <strong className="text-white">« Ouvrir les Réglages »</strong> ci-dessous.</li>
            <li>Dans <strong className="text-[#D4F63D]">myTrack</strong>, activez <strong className="text-white">Activités en direct</strong>.</li>
            <li>Assurez-vous aussi que <strong className="text-white">Réglages &gt; Face ID et code &gt; Activités en direct</strong> est activé.</li>
          </ol>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-[#20222B] hover:bg-[#282A36] text-xs font-bold text-[#8E929E] hover:text-white transition-colors"
          >
            Continuer sans
          </button>

          <button
            type="button"
            onClick={handleOpenSettings}
            className="flex-1 py-3 px-4 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#D4F63D]/15 transition-transform active:scale-95"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Ouvrir les Réglages</span>
          </button>
        </div>
      </div>
    </div>
  );
};
