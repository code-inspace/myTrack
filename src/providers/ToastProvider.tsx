"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

export interface ToastOptions {
  message: string;
  /** Optional action, typically "Annuler" */
  action?: { label: string; onClick: () => void };
  /** ms before it disappears (default 6000, 0 = stays until closed) */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

/**
 * App-wide toasts with an optional action ("Annuler"). The container is a polite live region, so
 * screen readers announce each message without moving focus.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-2), { ...options, id }]);
      const duration = options.duration ?? 6000;
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] md:bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-[#343740] bg-[#1C1D22] px-4 py-3 text-sm text-white shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <span className="flex-1 min-w-0">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="flex-shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold text-[#D4F63D] hover:bg-white/5 cursor-pointer"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer la notification"
              className="flex-shrink-0 rounded-lg p-1 text-[#8E929E] hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
