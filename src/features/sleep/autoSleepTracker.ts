/**
 * AutoSleepTracker - Désactivé à la demande de l'utilisateur
 * Le sommeil est désormais 100% contrôlé manuellement via le bouton "Je me couche".
 * Aucune détection automatique ni 2ème sommeil automatique n'est déclenché.
 */

export const STORAGE_KEY_LAST_CLOSED = "mytrack_last_app_closed_iso";
export const STORAGE_KEY_LAST_OPENED = "mytrack_last_app_opened_iso";
export const STORAGE_KEY_LAST_AUTO_DETECTED_DATE = "mytrack_last_auto_sleep_date";

export interface AutoSleepDetectionResult {
  detected: boolean;
  bedtime?: string;
  wakeTime?: string;
  bedtimeDate?: string;
  wakeDate?: string;
  durationMinutes?: number;
  reason?: string;
}

export const SLEEP_CONFIG = {
  MIN_SLEEP_MINUTES: 180,
  MAX_SLEEP_MINUTES: 1080,
};

/**
 * Enregistrement de fermeture / background (pas d'auto-détection de sommeil)
 */
export function recordAppBackground(now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_LAST_CLOSED, now.toISOString());
  } catch {}
}

/**
 * Retour au premier plan (pas d'auto-détection de sommeil)
 */
export function processAppForeground(now: Date = new Date()): AutoSleepDetectionResult {
  if (typeof window === "undefined") {
    return { detected: false, reason: "Server environment" };
  }
  try {
    localStorage.setItem(STORAGE_KEY_LAST_OPENED, now.toISOString());
  } catch {}

  return { detected: false, reason: "Automatic sleep detection is disabled" };
}

/**
 * Initialisation - désactivée
 */
export function initAutoSleepTracking(): () => void {
  return () => {};
}
