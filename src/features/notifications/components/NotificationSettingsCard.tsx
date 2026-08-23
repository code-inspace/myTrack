"use client";

import React, { useState } from "react";
import { NotificationPreference, CustomReminder } from "../types";
import { Bell, Clock, Plus, Trash2, Send, CheckCircle } from "lucide-react";
import { requestNotificationPermission } from "@/lib/onesignal/client";
import { sendNativeNotification } from "@/lib/notifications/service";

import { NotificationPermissionButton } from "./NotificationPermissionButton";

interface NotificationSettingsCardProps {
  preferences: NotificationPreference;
  reminders: CustomReminder[];
  onUpdatePreferences: (prefs: NotificationPreference) => void;
  onOpenNewReminder: () => void;
  onDeleteReminder: (id: string) => void;
  onTestNotification: (reminder: CustomReminder) => void;
}

export const NotificationSettingsCard: React.FC<NotificationSettingsCardProps> = ({
  preferences,
  reminders,
  onUpdatePreferences,
  onOpenNewReminder,
  onDeleteReminder,
  onTestNotification,
}) => {
  const [prefs, setPrefs] = useState(preferences);

  const handleToggle = async (key: keyof NotificationPreference) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    onUpdatePreferences(updated);
  };

  return (
    <div className="w-full space-y-4">
      {/* General toggles card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#252830] flex items-center justify-center text-[#D4F63D]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Notifications Push</h4>
              <p className="text-xs text-[#8E929E]">Activer sur l'appareil et le navigateur</p>
            </div>
          </div>
        </div>

        {/* Universal Cross-Device Activation & Test Button */}
        <div className="pt-1">
          <NotificationPermissionButton />
        </div>

        <div className="pt-3 border-t border-[#282A30] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#D1D5DB]">Rappel matinal (08:00)</span>
            <button
              onClick={() => handleToggle("morningReminder")}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                prefs.morningReminder ? "bg-[#D4F63D]" : "bg-[#282A30]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-black transition-transform transform ${
                  prefs.morningReminder ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#D1D5DB]">Bilan du soir (21:00)</span>
            <button
              onClick={() => handleToggle("eveningRecap")}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                prefs.eveningRecap ? "bg-[#D4F63D]" : "bg-[#282A30]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-black transition-transform transform ${
                  prefs.eveningRecap ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#D1D5DB]">Alerte protection de streak</span>
            <button
              onClick={() => handleToggle("streakReminder")}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                prefs.streakReminder ? "bg-[#D4F63D]" : "bg-[#282A30]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-black transition-transform transform ${
                  prefs.streakReminder ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Custom Actionable Reminders Card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-white">Rappels interactifs</h4>
            <p className="text-xs text-[#8E929E]">Questions actionnables avec validation OUI/NON directe</p>
          </div>

          <button
            onClick={onOpenNewReminder}
            className="p-2 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#D4F63D] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mt-3">
          {reminders.map((rem) => (
            <div
              key={rem.id}
              className="p-3.5 rounded-2xl bg-[#252830]/80 border border-[#343740] flex items-center justify-between gap-2"
            >
              <div>
                <p className="text-xs font-bold text-white">{rem.question}</p>
                <div className="flex items-center gap-2 text-[11px] text-[#8E929E] mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{rem.time}</span>
                  <span>•</span>
                  <span>{rem.taskTitle || "Habitude"}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDeleteReminder(rem.id)}
                  className="p-1 text-[#6B7280] hover:text-[#F87171] transition-colors cursor-pointer"
                  title="Supprimer ce rappel"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
