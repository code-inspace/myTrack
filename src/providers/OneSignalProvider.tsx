"use client";

import { useEffect } from "react";
import { initOneSignal } from "@/lib/onesignal/client";

export default function OneSignalProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initOneSignal();
  }, []);

  return <>{children}</>;
}
