"use client";

import { useEffect } from "react";

/**
 * Tells MyTrack you are working on this app. Drop it in the root layout of a Next.js app.
 *
 * Dev only: it does nothing in a production build, so real users never trigger it and the token
 * never ships. Configure in .env.local (gitignored):
 *   NEXT_PUBLIC_MYTRACK_URL=http://localhost:3000        (where MyTrack runs, or its deployed URL)
 *   NEXT_PUBLIC_MYTRACK_TOKEN=<token from MyTrack > Profil > Suivi automatique > Copier la config>
 *   NEXT_PUBLIC_MYTRACK_KEY=letscook                     (project key shown in MyTrack)
 *
 * A ping is sent every 60 s while the tab is visible, focused, and you interacted in the last
 * 2 minutes. MyTrack ends the session by itself after 3 minutes without a ping.
 */
const URL_ = process.env.NEXT_PUBLIC_MYTRACK_URL;
const TOKEN = process.env.NEXT_PUBLIC_MYTRACK_TOKEN;
const KEY = process.env.NEXT_PUBLIC_MYTRACK_KEY;
const ENABLED = process.env.NODE_ENV === "development" && Boolean(URL_ && TOKEN && KEY);

const HEARTBEAT_MS = 60_000;
const ACTIVE_WINDOW_MS = 2 * 60_000;

export function MyTrackHeartbeat() {
  useEffect(() => {
    if (!ENABLED) return;
    let lastInteraction = Date.now();
    const touch = () => {
      lastInteraction = Date.now();
    };
    const send = (event: "ping" | "end") => {
      fetch(`${URL_!.replace(/\/$/, "")}/api/activity/ping`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", "X-Widget-Token": TOKEN! },
        body: JSON.stringify({ key: KEY, origin: "web", event }),
      }).catch(() => {});
    };
    const tick = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (Date.now() - lastInteraction > ACTIVE_WINDOW_MS) return;
      send("ping");
    };

    const events = ["pointermove", "keydown", "scroll", "click"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(tick, HEARTBEAT_MS);
    tick();
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
