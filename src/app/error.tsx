"use client";

import React, { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 bg-[#0E0F12] text-white text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#1C1D22] border border-[#282A30] flex items-center justify-center text-[#D4F63D] mb-4 shadow-lg">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-bold text-white mb-2">Une erreur est survenue</h2>
      <p className="text-xs text-[#8E929E] max-w-sm mb-6 leading-relaxed">
        L'application a été mise à jour ou n'a pas pu charger certains éléments. Clique sur Réessayer pour recharger la page.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="px-5 py-2.5 rounded-xl bg-[#D4F63D] text-black text-xs font-bold flex items-center gap-2 hover:bg-[#C2E232] transition-colors shadow-md cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Recharger la page</span>
        </button>
      </div>
    </div>
  );
}
