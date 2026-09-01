"use client";

import React, { useState } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  X,
  RefreshCw,
  HelpCircle,
  Check,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Play,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarSubscription, DEFAULT_CALENDAR_COLORS } from "../types";
import { CalendarSyncSummary } from "../hooks/useCalendarEvents";

interface TestResult {
  success: boolean;
  eventCount?: number;
  sampleEvents?: Array<{
    title: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    isAllDay?: boolean;
    location?: string | null;
  }>;
  message?: string;
  error?: string;
  statusCode?: number;
  preview?: string;
}

interface CalendarSubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: CalendarSubscription[];
  onAddSubscription: (sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt">) => void;
  onUpdateSubscription?: (id: string, updates: Partial<CalendarSubscription>) => void;
  onDeleteSubscription: (id: string) => void;
  onToggleSubscription: (id: string) => void;
  onRefresh: () => void;
  onSyncNow?: () => Promise<any>;
  syncSummary?: CalendarSyncSummary | null;
  isRefetching?: boolean;
  errors?: Record<string, string>;
}

export const CalendarSubscriptionsModal: React.FC<CalendarSubscriptionsModalProps> = ({
  isOpen,
  onClose,
  subscriptions,
  onAddSubscription,
  onUpdateSubscription,
  onDeleteSubscription,
  onToggleSubscription,
  onRefresh,
  onSyncNow,
  syncSummary,
  isRefetching,
  errors = {},
}) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(DEFAULT_CALENDAR_COLORS[0]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showAuthFields, setShowAuthFields] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testingSubId, setTestingSubId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (sub: CalendarSubscription) => {
    setEditingId(sub.id);
    setName(sub.name);
    setUrl(sub.url);
    setColor(sub.color || DEFAULT_CALENDAR_COLORS[0]);
    setUsername(sub.username || "");
    setPassword(sub.password || "");
    setShowAuthFields(Boolean(sub.username || sub.password));
    setFormError(null);
    setTestResult(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setUrl("");
    setUsername("");
    setPassword("");
    setShowAuthFields(false);
    setFormError(null);
    setTestResult(null);
    setColor(DEFAULT_CALENDAR_COLORS[(subscriptions.length + 1) % DEFAULT_CALENDAR_COLORS.length]);
  };

  const handleTestConnection = async (targetSub?: Partial<CalendarSubscription>) => {
    const testUrl = (targetSub?.url || url).trim();
    const testName = (targetSub?.name || name).trim() || "Test";
    const testColor = targetSub?.color || color;
    const testUser = (targetSub?.username ?? username ?? "").trim();
    const testPass = (targetSub?.password ?? password ?? "").trim();

    if (!testUrl) {
      setFormError("Veuillez saisir une URL avant de tester.");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setFormError(null);

    try {
      const res = await fetch("/api/calendar/ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testSubscription: {
            id: targetSub?.id || "test",
            name: testName,
            url: testUrl,
            color: testColor,
            enabled: true,
            username: testUser || null,
            password: testPass || null,
          },
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: `Erreur de communication : ${err?.message || err}`,
      });
    } finally {
      setIsTesting(false);
      setTestingSubId(null);
    }
  };

  const handleTestSavedCalendar = (sub: CalendarSubscription) => {
    setTestingSubId(sub.id);
    handleTestConnection(sub);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    let trimmedUrl = url.trim();

    if (!trimmedName) {
      setFormError("Veuillez indiquer un nom pour ce calendrier.");
      return;
    }
    if (!trimmedUrl) {
      setFormError("Veuillez saisir l'URL du flux .ics / CalDAV.");
      return;
    }

    if (
      !trimmedUrl.startsWith("http://") &&
      !trimmedUrl.startsWith("https://") &&
      !trimmedUrl.startsWith("webcal://")
    ) {
      setFormError("L'URL doit commencer par https:// ou webcal://");
      return;
    }

    if (editingId && onUpdateSubscription) {
      onUpdateSubscription(editingId, {
        name: trimmedName,
        url: trimmedUrl,
        color,
        username: username.trim() || null,
        password: password.trim() || null,
      });
      handleCancelEdit();
    } else {
      onAddSubscription({
        name: trimmedName,
        url: trimmedUrl,
        color,
        enabled: true,
        username: username.trim() || null,
        password: password.trim() || null,
      });
      setName("");
      setUrl("");
      setUsername("");
      setPassword("");
      setShowAuthFields(false);
      setTestResult(null);
      setColor(DEFAULT_CALENDAR_COLORS[(subscriptions.length + 1) % DEFAULT_CALENDAR_COLORS.length]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-[#141518] border border-[#282A34] shadow-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#23242E] flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6] flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">Agendas Connectés</h3>
              <p className="text-[11px] text-[#8E929E] truncate">Google, Apple, iCal &amp; CalDAV</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onSyncNow || onRefresh}
              disabled={isRefetching || syncSummary?.status === "syncing"}
              title="Synchroniser tous les agendas"
              className={cn(
                "h-9 px-3 rounded-xl bg-[#1F212A] border border-[#2D303E] text-xs font-bold text-[#8E929E] hover:text-white flex items-center gap-1.5 transition-all cursor-pointer active:scale-95",
                (isRefetching || syncSummary?.status === "syncing") && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", (isRefetching || syncSummary?.status === "syncing") && "animate-spin text-[#D4F63D]")} />
              <span className="hidden sm:inline">Synchroniser</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[#8E929E] hover:text-white hover:bg-[#20222B] transition-colors cursor-pointer flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Sync Status Banner */}
        {syncSummary && (
          <div
            className={cn(
              "mx-6 mt-4 p-3.5 rounded-2xl border transition-all animate-in fade-in slide-in-from-top-2 duration-200",
              syncSummary.status === "syncing"
                ? "bg-[#3B82F6]/10 border-[#3B82F6]/30 text-white"
                : syncSummary.status === "error"
                ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-white"
                : "bg-[#10B981]/10 border-[#10B981]/30 text-white"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {syncSummary.status === "syncing" ? (
                  <RefreshCw className="w-4 h-4 text-[#38BDF8] animate-spin flex-shrink-0" />
                ) : syncSummary.status === "error" ? (
                  <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                )}
                <div>
                  <p className="text-xs font-bold leading-tight">{syncSummary.message}</p>
                  {syncSummary.syncedAt && (
                    <p className="text-[10px] text-[#8E929E] mt-0.5">Dernière synchronisation à {syncSummary.syncedAt}</p>
                  )}
                </div>
              </div>

              {syncSummary.status === "success" && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-lg bg-[#10B981]/20 text-[#10B981] text-[10px] font-mono font-bold">
                    {syncSummary.totalRetrieved} récupéré{syncSummary.totalRetrieved > 1 ? "s" : ""}
                  </span>
                  {syncSummary.addedCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-lg bg-[#D4F63D]/20 text-[#D4F63D] text-[10px] font-mono font-bold">
                      +{syncSummary.addedCount} nouveau{syncSummary.addedCount > 1 ? "x" : ""}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-lg bg-[#252830] text-[#8E929E] text-[10px] font-mono font-bold">
                      0 nouveau
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Subscriptions List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-[#8E929E] uppercase tracking-wider">
                Mes Agendas ({subscriptions.length})
              </h4>
            </div>

            {subscriptions.length === 0 ? (
              <div className="p-5 rounded-2xl bg-[#1A1B22] border border-[#282B38] text-center space-y-2">
                <Calendar className="w-8 h-8 text-[#6B7280] mx-auto opacity-60" />
                <p className="text-sm font-semibold text-white">Aucun calendrier connecté</p>
                <p className="text-xs text-[#8E929E]">
                  Ajoutez ci-dessous le lien de votre Google Calendar, Apple iCal ou CalDAV d&apos;entreprise pour synchroniser vos événements.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {subscriptions.map((sub) => {
                  const errorMsg = errors[sub.id];
                  const isBeingEdited = editingId === sub.id;
                  const isCurrentTesting = isTesting && testingSubId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-2xl border transition-all",
                        isBeingEdited
                          ? "bg-[#1F222F] border-[#D4F63D]/60 ring-1 ring-[#D4F63D]/40"
                          : sub.enabled
                          ? "bg-[#1A1B23] border-[#2A2D3C]"
                          : "bg-[#14151B] border-[#20222B] opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: sub.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white truncate">{sub.name}</span>
                            {sub.username && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#3B82F6]/20 text-[#60A5FA] font-medium border border-[#3B82F6]/30">
                                CalDAV Auth
                              </span>
                            )}
                            {errorMsg && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] text-red-400 font-medium px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20"
                                title={errorMsg}
                              >
                                <AlertCircle className="w-3 h-3" />
                                <span>Erreur</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#6B7280] truncate font-mono mt-0.5">
                            {sub.url}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Test button */}
                        <button
                          type="button"
                          onClick={() => handleTestSavedCalendar(sub)}
                          disabled={isTesting}
                          className="p-1.5 rounded-lg text-[#8E929E] hover:text-[#D4F63D] hover:bg-[#282B38] transition-colors cursor-pointer text-xs flex items-center gap-1"
                          title="Tester la connexion de cet agenda"
                        >
                          <Play className={cn("w-3.5 h-3.5", isCurrentTesting && "animate-spin text-[#D4F63D]")} />
                        </button>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(sub)}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors cursor-pointer",
                            isBeingEdited
                              ? "bg-[#D4F63D] text-black font-bold"
                              : "text-[#8E929E] hover:text-white hover:bg-[#282B38]"
                          )}
                          title="Modifier cet agenda"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle active switch */}
                        <button
                          type="button"
                          onClick={() => onToggleSubscription(sub.id)}
                          className={cn(
                            "relative inline-flex h-6 w-10 items-center rounded-full transition-colors cursor-pointer ml-1",
                            sub.enabled ? "bg-[#D4F63D]" : "bg-[#282B38]"
                          )}
                          title={sub.enabled ? "Désactiver" : "Activer"}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform",
                              sub.enabled ? "translate-x-5" : "translate-x-1 bg-white/70"
                            )}
                          />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => onDeleteSubscription(sub.id)}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-red-400 hover:bg-[#282A34] transition-colors cursor-pointer"
                          title="Supprimer ce calendrier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add / Edit Calendar Form */}
          <form onSubmit={handleSubmit} className="p-5 rounded-2xl bg-[#1A1B23] border border-[#2B2E3E] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit2 className="w-4 h-4 text-[#D4F63D]" />
                    <span>Modifier l&apos;agenda</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-[#D4F63D]" />
                    <span>Connecter un nouvel agenda</span>
                  </>
                )}
              </h4>

              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-[#8E929E] hover:text-white underline cursor-pointer"
                >
                  Annuler la modification
                </button>
              )}
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                  Nom du calendrier
                </label>
                <input
                  type="text"
                  placeholder="Ex : Google Pro, Événements Travail, iCloud..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121318] border border-[#2C3040] text-sm text-white placeholder-[#6B7280] focus:border-[#D4F63D] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                  URL iCal ou CalDAV (.ics, webcal:// ou lien Nextcloud/CalDAV)
                </label>
                <input
                  type="text"
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121318] border border-[#2C3040] text-xs font-mono text-white placeholder-[#6B7280] focus:border-[#D4F63D] outline-none transition-colors"
                />
              </div>

              {/* Optional CalDAV Credentials Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAuthFields(!showAuthFields)}
                  className="text-xs font-semibold text-[#3B82F6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{showAuthFields ? "Masquer les identifiants CalDAV" : "+ Authentification CalDAV / Mot de passe d'application"}</span>
                </button>

                {showAuthFields && (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-[#121318] border border-[#282B38] space-y-2.5 animate-in fade-in duration-150">
                    <p className="text-[11px] text-[#8E929E]">
                      Requis pour les serveurs CalDAV d&apos;entreprise sécurisés (Nextcloud, Zimbra, SOGo).
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                          Nom d&apos;utilisateur / Email
                        </label>
                        <input
                          type="text"
                          placeholder="votre_identifiant"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#181920] border border-[#2C3040] text-xs text-white placeholder-[#6B7280] focus:border-[#D4F63D] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                          Mot de passe d&apos;application CalDAV
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#181920] border border-[#2C3040] text-xs text-white placeholder-[#6B7280] focus:border-[#D4F63D] outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E929E] mb-1.5">
                  Couleur d&apos;affichage
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {DEFAULT_CALENDAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all flex items-center justify-center cursor-pointer",
                        color === c ? "ring-2 ring-white scale-110" : "opacity-75 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div className="pt-2 border-t border-[#262834] space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="submit"
                  className="w-full sm:flex-1 py-3 sm:py-2.5 px-4 rounded-xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer order-1 sm:order-2 active:scale-98"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingId ? "Mettre à jour l'agenda" : "Enregistrer et synchroniser"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestConnection()}
                  disabled={isTesting}
                  className={cn(
                    "w-full sm:w-auto py-3 sm:py-2.5 px-4 rounded-xl border border-[#3B82F6]/40 bg-[#1E293B]/60 hover:bg-[#1E293B] text-[#60A5FA] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer order-2 sm:order-1 active:scale-98",
                    isTesting && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <Play className={cn("w-3.5 h-3.5", isTesting && "animate-spin text-[#D4F63D]")} />
                  <span>{isTesting ? "Test de connexion en cours..." : "Tester la connexion"}</span>
                </button>
              </div>

              {/* Test Result Card */}
              {testResult && (
                <div
                  className={cn(
                    "p-4 rounded-2xl border text-xs space-y-2.5 animate-in fade-in duration-200",
                    testResult.success
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-red-950/30 border-red-500/40 text-red-200"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm">
                        {testResult.success ? "Connexion réussie !" : "Échec de la connexion"}
                      </div>
                      <p className="text-xs mt-0.5 opacity-90">
                        {testResult.message || testResult.error}
                      </p>
                      {testResult.preview && (
                        <pre className="mt-2 p-2 rounded bg-black/40 text-[10px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                          {testResult.preview}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Sample Events List */}
                  {testResult.success && testResult.sampleEvents && testResult.sampleEvents.length > 0 && (
                    <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                        Aperçu des prochains événements détectés :
                      </span>
                      <div className="space-y-1 mt-1">
                        {testResult.sampleEvents.map((evt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/30 border border-emerald-500/20 text-white text-xs"
                          >
                            <span className="font-semibold truncate">{evt.title}</span>
                            <div className="flex items-center gap-2 text-[10px] text-emerald-300 font-mono flex-shrink-0">
                              <span>{evt.date}</span>
                              {evt.startTime && <span>{evt.startTime}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>

          {/* Help Guide Collapsible */}
          <div className="rounded-2xl border border-[#252834] bg-[#16171E] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="w-full flex items-center justify-between p-4 text-xs font-bold text-[#8E929E] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#3B82F6]" />
                <span>Guide : Comment obtenir le bon lien d&apos;agenda ?</span>
              </div>
              {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showHelp && (
              <div className="px-4 pb-4 space-y-3.5 text-xs text-[#9CA3AF] border-t border-[#232530] pt-3">
                <div>
                  <h5 className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                    <span>Google Calendar</span>
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-[11px] leading-relaxed">
                    <li>Ouvrez Google Agenda sur ordinateur (<a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-[#3B82F6] underline">calendar.google.com</a>).</li>
                    <li>Dans la colonne de gauche, survolez votre calendrier &gt; <strong>3 points (...)</strong> &gt; <strong>Paramètres et partage</strong>.</li>
                    <li>Faites défiler tout en bas jusqu&apos;à la section <strong>Intégrer l&apos;agenda</strong>.</li>
                    <li>Copiez l&apos;<strong>« Adresse secrète au format iCal »</strong> (l&apos;URL se termine par <code>/basic.ics</code>).</li>
                    <li className="text-amber-300">⚠️ Ne copiez pas l&apos;adresse de la barre d&apos;adresse du navigateur ni le code iframe HTML.</li>
                  </ol>
                </div>

                <div>
                  <h5 className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span>Agenda Entreprise / Nextcloud / CalDAV</span>
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-[11px] leading-relaxed">
                    <li>Dans votre agenda web (ex: Nextcloud), cliquez sur les <strong>3 points (...)</strong> à côté de votre calendrier.</li>
                    <li>Sélectionnez <strong>« Copier le lien privé »</strong> ou <strong>« Lien d&apos;abonnement »</strong>.</li>
                    <li>Dans les paramètres de sécurité de votre compte, créez un mot de passe pour l&apos;application <em>Client d&apos;agenda CalDAV</em>.</li>
                    <li>Dans MyTrack, cliquez sur <strong>« + Authentification CalDAV »</strong> et collez ce mot de passe d&apos;application.</li>
                  </ol>
                </div>

                <div>
                  <h5 className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#A855F7]" />
                    <span>Apple iCal / iCloud</span>
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-[11px] leading-relaxed">
                    <li>Ouvrez l&apos;application Calendrier sur Mac ou iPhone / iCloud.com.</li>
                    <li>Cliquez sur l&apos;icône de partage à droite de votre calendrier.</li>
                    <li>Cochez <strong>Calendrier public</strong> et copiez l&apos;URL générée (commence par <code>webcal://</code>).</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
