"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { WifiOff, Wifi, Zap } from "lucide-react";

interface OfflineContextType {
  isOnline: boolean;
  isLowDataMode: boolean;
  toggleLowDataMode: (enabled?: boolean) => void;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  isLowDataMode: false,
  toggleLowDataMode: () => {},
});

export const useOffline = () => useContext(OfflineContext);

const LOW_DATA_KEY = "mytrack_low_data_mode";

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isLowDataMode, setIsLowDataMode] = useState(false);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const savedLowData = localStorage.getItem(LOW_DATA_KEY);
      if (savedLowData === "true") {
        setIsLowDataMode(true);
      }

      const handleOnline = () => {
        setIsOnline(true);
        setShowReconnectedToast(true);
        setTimeout(() => setShowReconnectedToast(false), 3500);
      };

      const handleOffline = () => {
        setIsOnline(false);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const toggleLowDataMode = (enabled?: boolean) => {
    setIsLowDataMode((prev) => {
      const next = enabled !== undefined ? enabled : !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(LOW_DATA_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <OfflineContext.Provider value={{ isOnline, isLowDataMode, toggleLowDataMode }}>
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-[#EF4444] text-white px-4 py-2 flex items-center justify-between text-xs font-bold shadow-lg animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
            <span>Mode hors ligne actif — Vos modifications sont conservées localement</span>
          </div>
          <span className="bg-black/20 px-2 py-0.5 rounded-full text-[10px] uppercase font-mono">
            Local First
          </span>
        </div>
      )}

      {/* Reconnected Toast */}
      {showReconnectedToast && (
        <div className="fixed top-3 right-3 z-50 bg-[#10B981] text-black px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top duration-300">
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>Connexion rétablie — Synchronisation terminée</span>
        </div>
      )}

      {/* Low Data Mode Floating Indicator */}
      {isLowDataMode && isOnline && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 bg-[#17181F]/90 backdrop-blur-md border border-[#F59E0B]/40 text-[#F59E0B] px-3 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-bold shadow-lg pointer-events-none select-none">
          <Zap className="w-3 h-3" />
          <span>Low Data</span>
        </div>
      )}

      {children}
    </OfflineContext.Provider>
  );
};
