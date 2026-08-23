"use client";

import { TaskWithCompletion } from "@/features/tasks/types";

let silentAudio: HTMLAudioElement | null = null;

/**
 * Creates a looping inaudible Web Audio buffer to keep the lock screen media session active.
 */
function getOrCreateSilentAudio(): HTMLAudioElement {
  if (!silentAudio && typeof window !== "undefined") {
    // 1-second silent MP3 base64 encoded
    const silentMp3Uri =
      "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//uEAAAAAAAAAAAAAAAAAAAAAAA=";
    silentAudio = new Audio(silentMp3Uri);
    silentAudio.loop = true;
    silentAudio.volume = 0.01; // Silent / minimal
  }
  return silentAudio!;
}

export function startLockScreenLiveActivity(
  task: TaskWithCompletion,
  options?: {
    onTogglePlay?: () => void;
    onComplete?: () => void;
    onNext?: () => void;
  }
) {
  if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

  try {
    const audio = getOrCreateSilentAudio();
    audio.play().catch(() => {
      // Audio playback requires a user gesture; caught gracefully
    });

    const isQuantitative =
      task.trackingType === "NUMBER" ||
      task.trackingType === "QUANTITY" ||
      task.trackingType === "DURATION";

    const detailText = isQuantitative
      ? `${task.currentValue ?? 0} / ${task.targetValue ?? ""} ${task.unit || ""}`
      : "En cours • Activité en direct";

    navigator.mediaSession.metadata = new MediaMetadata({
      title: task.title,
      artist: `MyTrack • ${detailText}`,
      album: `Activité en direct • ${task.category}`,
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });

    // Action handlers for Lock Screen widget controls
    navigator.mediaSession.setActionHandler("play", () => {
      options?.onTogglePlay?.();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      options?.onTogglePlay?.();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      options?.onComplete?.();
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      options?.onNext?.();
    });
  } catch (err) {
    console.warn("MediaSession Live Activity initialization error:", err);
  }
}

export function stopLockScreenLiveActivity() {
  if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

  try {
    if (silentAudio) {
      silentAudio.pause();
      silentAudio.currentTime = 0;
    }
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler("play", null);
    navigator.mediaSession.setActionHandler("pause", null);
    navigator.mediaSession.setActionHandler("nexttrack", null);
    navigator.mediaSession.setActionHandler("previoustrack", null);
  } catch (err) {
    console.warn("MediaSession cleanup error:", err);
  }
}
