"use client";

import React, { createContext, useContext, useState } from "react";
import { getTodayDateString } from "@/lib/dates";

interface DateContextType {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const DateContext = createContext<DateContextType | null>(null);

export const DateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedDate, setSelectedDateState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("mytrack_selected_date");
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
    }
    return getTodayDateString();
  });

  const setSelectedDate = (date: string) => {
    setSelectedDateState(date);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("mytrack_selected_date", date);
      } catch {}
    }
  };

  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  );
};

export const useSelectedDate = (): DateContextType => {
  const ctx = useContext(DateContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    const today = getTodayDateString();
    return { selectedDate: today, setSelectedDate: () => {} };
  }
  return ctx;
};
