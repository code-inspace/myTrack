"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type DisplayMode = "modern" | "classic";

const STORAGE_KEY = "mytrack_display_mode";
const DEFAULT_MODE: DisplayMode = "modern";

interface DisplayModeContextValue {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
}

const DisplayModeContext = createContext<DisplayModeContextValue | undefined>(undefined);

export const DisplayModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(DEFAULT_MODE);

  // Read the stored preference after mount to avoid a server/client hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "classic" || stored === "modern") setDisplayModeState(stored);
    } catch {}
  }, []);

  const setDisplayMode = (mode: DisplayMode) => {
    setDisplayModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  };

  return (
    <DisplayModeContext.Provider value={{ displayMode, setDisplayMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
};

export function useDisplayMode() {
  const ctx = useContext(DisplayModeContext);
  if (!ctx) {
    throw new Error("useDisplayMode must be used within a DisplayModeProvider");
  }
  return ctx;
}
