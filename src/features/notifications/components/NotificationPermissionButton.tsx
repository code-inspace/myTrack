"use client";

import React, { useState, useEffect } from "react";
import { Bell, Smartphone } from "lucide-react";
import {
  enableCrossDeviceNotifications,
  isIosDevice,
  isStandalonePwa,
  NotificationStatusResult,
} from "@/lib/notifications/enableNotifications";
import { cn } from "@/lib/utils";

interface NotificationPermissionButtonProps {
  className?: string;
  variant?: "banner" | "button" | "card";
}

export const NotificationPermissionButton: React.FC<NotificationPermissionButtonProps> = ({
  className,
}) => {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "ios_needed">("default");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isIos = isIosDevice();
    const isPwa = isStandalonePwa();

    if (isIos && !isPwa && !("Notification" in window)) {
      setPermission("ios_needed");
      return;
    }

    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
  }, []);

  const handleEnable = async () => {
    if (permission === "ios_needed") {
      setShowIosGuide(true);
      return;
    }

    setLoading(true);
    setFeedback(null);

    const res: NotificationStatusResult = await enableCrossDeviceNotifications();
    setLoading(false);

    if (res.status === "ios_standalone_needed") {
      setShowIosGuide(true);
    } else if (res.status === "granted") {
      setPermission("granted");
    } else {
      setFeedback(res.message);
    }
  };

  // If already granted, hide button completely!
  if (permission === "granted") {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-2">
        <button
          onClick={handleEnable}
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs shadow-lg transition-all cursor-pointer",
            permission === "denied"
              ? "bg-[#252830] text-[#F87171] border border-[#F87171]/30 hover:bg-[#2F333E]"
              : "bg-[#D4F63D] hover:bg-[#c2e42f] text-black active:scale-[0.98] lime-glow-sm"
          )}
        >
          <Bell className="w-4 h-4 fill-current animate-bounce" />
          <span>
            {loading
              ? "Activation en cours..."
              : permission === "denied"
              ? "⚠️ Notifications bloquées (clique pour instructions)"
              : "🔔 Activer les notifications sur cet appareil"}
          </span>
        </button>

        {feedback && (
          <p className="text-[11px] text-center font-medium text-[#D4F63D] bg-[#D4F63D]/10 py-1 px-2 rounded-lg">
            {feedback}
          </p>
        )}
      </div>

      {/* iOS Standalone Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1D22] border border-[#2E313B] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-[#D4F63D]/15 text-[#D4F63D] flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white">
              Activation sur iPhone & iPad
            </h3>

            <p className="text-xs text-[#8E929E] leading-relaxed text-left">
              Pour recevoir les notifications push sur iOS :
              <br /><br />
              1. Clique sur le bouton <strong>Partager</strong> en bas de Safari (icône carré avec flèche vers le haut).
              <br />
              2. Fais défiler et sélectionne <strong>« Sur l'écran d'accueil »</strong>.
              <br />
              3. Ouvre l'application <strong>MyTrack</strong> depuis ton écran d'accueil et clique sur « Activer les notifications ».
            </p>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#D4F63D] text-black font-bold text-xs cursor-pointer"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
