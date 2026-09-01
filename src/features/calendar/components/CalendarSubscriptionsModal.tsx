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
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarSubscription, DEFAULT_CALENDAR_COLORS } from "../types";

interface CalendarSubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: CalendarSubscription[];
  onAddSubscription: (sub: Omit<CalendarSubscription, "id" | "createdAt" | "updatedAt">) => void;
  onDeleteSubscription: (id: string) => void;
  onToggleSubscription: (id: string) => void;
  onRefresh: () => void;
  isRefetching?: boolean;
  errors?: Record<string, string>;
}

export const CalendarSubscriptionsModal: React.FC<CalendarSubscriptionsModalProps> = ({
  isOpen,
  onClose,
  subscriptions,
  onAddSubscription,
  onDeleteSubscription,
  onToggleSubscription,
  onRefresh,
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

  if (!isOpen) return null;

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

    // Basic URL validation
    if (
      !trimmedUrl.startsWith("http://") &&
      !trimmedUrl.startsWith("https://") &&
      !trimmedUrl.startsWith("webcal://")
    ) {
      setFormError("L'URL doit commencer par https:// ou webcal://");
      return;
    }

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
    setColor(DEFAULT_CALENDAR_COLORS[(subscriptions.length + 1) % DEFAULT_CALENDAR_COLORS.length]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-[#141518] border border-[#282A34] shadow-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#23242E] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Agendas iCal &amp; Google</h3>
              <p className="text-xs text-[#8E929E]">Abonnements aux calendriers externes (.ics)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefetching}
              title="Rafraîchir les agendas"
              className={cn(
                "p-2 rounded-xl bg-[#1F212A] border border-[#2D303E] text-[#8E929E] hover:text-white transition-all cursor-pointer",
                isRefetching && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin text-[#D4F63D]")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#8E929E] hover:text-white hover:bg-[#20222B] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Subscriptions List */}
          <div>
            <h4 className="text-xs font-semibold text-[#8E929E] uppercase tracking-wider mb-3">
              Mes Agendas Connectés ({subscriptions.length})
            </h4>

            {subscriptions.length === 0 ? (
              <div className="p-5 rounded-2xl bg-[#1A1B22] border border-[#282B38] text-center space-y-2">
                <Calendar className="w-8 h-8 text-[#6B7280] mx-auto opacity-60" />
                <p className="text-sm font-semibold text-white">Aucun calendrier connecté</p>
                <p className="text-xs text-[#8E929E]">
                  Ajoutez ci-dessous le lien iCal (.ics) de votre Google Calendar ou Apple iCal pour voir vos événements dans l&apos;agenda.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {subscriptions.map((sub) => {
                  const errorMsg = errors[sub.id];
                  return (
                    <div
                      key={sub.id}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-2xl border transition-all",
                        sub.enabled
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate">{sub.name}</span>
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

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Toggle active switch */}
                        <button
                          type="button"
                          onClick={() => onToggleSubscription(sub.id)}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer",
                            sub.enabled ? "bg-[#D4F63D]" : "bg-[#282B38]"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-black transition-transform",
                              sub.enabled ? "translate-x-6" : "translate-x-1 bg-white/70"
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
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Calendar Form */}
          <form onSubmit={handleSubmit} className="p-5 rounded-2xl bg-[#1A1B23] border border-[#2B2E3E] space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#D4F63D]" />
              <span>Ajouter un calendrier iCal / .ics</span>
            </h4>

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
                  placeholder="Ex : Google Pro, Événements Famille, iCloud..."
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
                  placeholder="https://cloud.entreprise.fr/.../calendar?export ou https://.../basic.ics"
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
                      Requis pour les serveurs CalDAV sécurisés (Nextcloud, Zimbra, SOGo).
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

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer mt-2"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Connecter ce calendrier</span>
            </button>
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
                <span>Comment obtenir l&apos;URL de mon agenda ? (Google, Apple, Nextcloud / CalDAV)</span>
              </div>
              {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showHelp && (
              <div className="px-4 pb-4 space-y-3.5 text-xs text-[#9CA3AF] border-t border-[#232530] pt-3">
                <div>
                  <h5 className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span>Agenda Entreprise / Nextcloud / CalDAV</span>
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-[11px] leading-relaxed">
                    <li>Dans votre agenda (ex: Nextcloud), cliquez sur les <strong>3 points (...)</strong> à côté de votre calendrier.</li>
                    <li>Sélectionnez <strong>Copier le lien privé</strong> ou <strong>Lien d&apos;abonnement</strong> (ex: <code>https://cloud.entreprise.fr/.../calendar</code>).</li>
                    <li>Générez un <strong>mot de passe d&apos;application</strong> dans Paramètres &gt; Sécurité (comme sur votre capture d&apos;écran en sélectionnant <em>Client d&apos;agenda CalDAV</em>).</li>
                    <li>Renseignez l&apos;URL, votre identifiant et ce mot de passe d&apos;application dans le formulaire ci-dessus.</li>
                  </ol>
                </div>

                <div>
                  <h5 className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                    <span>Google Calendar</span>
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-[11px] leading-relaxed">
                    <li>Ouvrez Google Agenda sur votre ordinateur.</li>
                    <li>Dans la colonne de gauche, survolez votre agenda &gt; 3 points &gt; <strong>Paramètres et partage</strong>.</li>
                    <li>Faites défiler jusqu&apos;à la section <strong>Intégrer l&apos;agenda</strong>.</li>
                    <li>Copiez l&apos;<strong>Adresse secrète au format iCal</strong>.</li>
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
                    <li>Cochez <strong>Calendrier public</strong> et copiez l&apos;URL générée.</li>
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
