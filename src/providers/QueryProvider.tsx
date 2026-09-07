"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

if (typeof window !== "undefined") {
  const win = window as any;
  if (!win.Capacitor || typeof win.Capacitor.triggerEvent !== "function") {
    win.Capacitor = win.Capacitor || {};
    win.Capacitor.triggerEvent = win.Capacitor.triggerEvent || function (name: string, _target: any, data: any) {
      window.dispatchEvent(new CustomEvent(name, { detail: data }));
    };
  }
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

