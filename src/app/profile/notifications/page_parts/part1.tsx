"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Clock,
  Plus,
  Trash2,
  Zap,
  ShieldAlert,
  Moon,
  Sun,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { NotificationPreference, CustomReminder } from "@/features/notifications/types";
import {
  getStoredPreferences,
  saveStoredPreferences,
  updateDbPreferences,
  getStoredReminders,
  saveStoredReminders,
  saveDbReminder,
  deleteDbReminder,
} from "@/features/notifications/actions";
import { sendNativeNotification } from "@/lib/notifications/service";
import { NotificationPermissionButton } from "@/features/notifications/components/NotificationPermissionButton";
import { CustomReminderModal } from "@/features/notifications/components/CustomReminderModal";
import { InteractiveNotificationSheet } from "@/features/notifications/components/InteractiveNotificationSheet";
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 heure" },
  { value: 120, label: "2 heures" },
];

const DAYS_SHORT = [
  { index: 1, label: "L" },
  { index: 2, label: "M" },
  { index: 3, label: "M" },
  { index: 4, label: "J" },
  { index: 5, label: "V" },
  { index: 6, label: "S" },
  { index: 0, label: "D" },
];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreference>(getStoredPreferences);
  const [reminders, setReminders] = useState<CustomReminder[]>(getStoredReminders);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [testNotification, setTestNotification] = useState<{ isOpen: boolean; question: string; taskTitle: string }>({
    isOpen: false,
    question: "",
    taskTitle: "",
  });

  useEffect(() => {
    setPrefs(getStoredPreferences());
    setReminders(getStoredReminders());
  }, []);

  const handleUpdatePrefs = (newPrefs: NotificationPreference) => {
    setPrefs(newPrefs);
    saveStoredPreferences(newPrefs);
    updateDbPreferences(newPrefs);
  };

  // Master Mute Toggle with full previous state restoration
  const handleToggleMasterMute = () => {
    if (!prefs.allDisabled) {
      // Activating Master Mute: snapshot current state
      const backup: Partial<NotificationPreference> = {
        pushEnabled: prefs.pushEnabled,
        morningReminder: prefs.morningReminder,
        eveningRecap: prefs.eveningRecap,
        streakReminder: prefs.streakReminder,
        currentActionCheckinEnabled: prefs.currentActionCheckinEnabled,
      };
      const updated: NotificationPreference = {
        ...prefs,
        allDisabled: true,
        previousPreferencesBackup: backup,
      };
      handleUpdatePrefs(updated);
    } else {
      // Deactivating Master Mute: restore exact previous settings
      const backup = prefs.previousPreferencesBackup || {};
      const updated: NotificationPreference = {
        ...prefs,
        allDisabled: false,
        pushEnabled: backup.pushEnabled ?? true,
        morningReminder: backup.morningReminder ?? true,
        eveningRecap: backup.eveningRecap ?? true,
        streakReminder: backup.streakReminder ?? true,
        currentActionCheckinEnabled: backup.currentActionCheckinEnabled ?? false,
        previousPreferencesBackup: null,
      };
      handleUpdatePrefs(updated);
    }
  };

  const handleTogglePref = (key: keyof NotificationPreference) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    handleUpdatePrefs(updated);
  };

  const handleSaveCustomReminder = (data: any) => {
    const newRem: CustomReminder = {
      ...data,
      id: "rem-" + Date.now(),
      userId: "user-local",
    };
    const updated = [...reminders, newRem];
    setReminders(updated);
    saveStoredReminders(updated);
    saveDbReminder(newRem);
  };

  const handleDeleteReminder = (id: string) => {
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);
    saveStoredReminders(updated);
    deleteDbReminder(id);
  };

  const handleTestCheckinNotification = async () => {
    await sendNativeNotification({
      title: "⚡ Que fais-tu actuellement ?",
      body: "Prends 5 secondes pour enregistrer ton action ou ton habitude sur MyTrack !",
      tag: "test-checkin",
      actions: [
        { action: "LOG", title: "📝 Enregistrer" },
        { action: "LATER", title: "Plus tard" },
      ],
    });
  };

  const toggleDay = (dayIndex: number) => {
    const currentDays = prefs.currentActionDays || [1, 2, 3, 4, 5];
    let nextDays: number[];
    if (currentDays.includes(dayIndex)) {
      nextDays = currentDays.filter((d) => d !== dayIndex);
    } else {
      nextDays = [...currentDays, dayIndex];
    }
    handleUpdatePrefs({ ...prefs, currentActionDays: nextDays });
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen bg-[#0E0F12] text-white relative overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-[#282A30] bg-[#141518]/90 backdrop-blur-md flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="p-2 rounded-xl bg-[#22242B] hover:bg-[#2C2E38] text-[#8E929E] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#D4F63D]" />
              <span>Gestion des Notifications</span>
            </h1>
            <p className="text-[11px] text-[#8E929E]">Rappels, bilans & check-in en temps réel</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-md mx-auto w-full pb-28">
        {/* ========================================================================= */}
        {/* 1. MASTER MUTE TOGGLE (Désactiver tout & Restaurer l'état précédent)       */}
        {/* ========================================================================= */}
        <div
          className={cn(
            "p-4 rounded-3xl border transition-all shadow-md flex items-center justify-between gap-3",
            prefs.allDisabled
              ? "bg-[#25191C] border-[#EF4444]/40"
              : "bg-[#1C1D22] border-[#282A30]"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm",
                prefs.allDisabled ? "bg-[#EF4444]/20 text-[#EF4444]" : "bg-[#252830] text-[#D4F63D]"
              )}
            >
              {prefs.allDisabled ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">