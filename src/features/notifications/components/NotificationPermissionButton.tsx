"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckCircle2, Smartphone, Sparkles, RefreshCw } from "lucide-react";
import {
  enableCrossDeviceNotifications,
  isIosDevice,
  isStandalonePwa,
  NotificationStatusResult,
} from "@/lib/notifications/enableNotifications";
import { sendNativeNotification } from "@/lib/notifications/service";
import { cn } from "@/lib/utils";

interface NotificationPermissionButtonProps {
  className?: string;
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
      setFeedback("Notifications activées avec succès sur cet appareil !");
    } else {
      setFeedback(res.message);
    }
  };

  const handleTestNotification = async () => {
    await sendNativeNotification({
      title: "🔔 Test MyTrack Réussi !",
      body: "Les notifications push fonctionnent parfaitement sur votre appareil.",
      tag: "direct-test",
    });
    setFeedback("Notification de test envoyée sur votre écran !");
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className={cn("w-full space-y-2.5", className)}>
      {/* 1. If Permission is Granted: Show active status card */}
      {permission === "granted" ? (
        <div className="p-3.5 rounded-2xl bg-[#141518] border border-[#2B2E38] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#D4F63D]/15 text-[#D4F63D] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Notifications actives sur cet appareil</span>
                </div>
                <div className="text-[10px] text-[#8E929E]">
                  Rappels programmés & bilans opérationnels
                </div>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-[#D4F63D]/20 border border-[#D4F63D]/30 text-[#D4F63D] text-[10px] font-bold">
              Connecté
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-[#252830]">
            <button
              type="button"
              onClick={handleTestNotification}
              className="flex-1 py-2 px-3 rounded-xl bg-[#22242B] hover:bg-[#2E313C] border border-[#343740] text-[11px] font-bold text-[#D4F63D] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tester une notif</span>
            </button>

            <button
              type="button"
              onClick={handleEnable}
              disabled={loading}
              title="Re-synchroniser la souscription"
              className="py-2 px-3 rounded-xl bg-[#22242B] hover:bg-[#2E313C] border border-[#343740] text-[11px] font-bold text-[#9CA3AF] hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span>Re-synchroniser</span>
            </button>
          </div>
        </div>
      ) : (
        /* 2. If Permission is not granted yet: Show Activation Button */
        <div className="flex flex-col gap-2">
          <button
            type="button"
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
        </div>
      )}

      {feedback && (
        <p className="text-[11px] text-center font-medium text-[#D4F63D] bg-[#D4F63D]/10 py-1.5 px-3 rounded-xl animate-in fade-in duration-200">
          {feedback}
        </p>
      )}

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
              type="button"
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
