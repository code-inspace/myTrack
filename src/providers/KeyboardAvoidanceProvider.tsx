"use client";

import React, { useEffect } from "react";

export const KeyboardAvoidanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    const updateViewportAndKeyboard = () => {
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty("--visual-viewport-height", `${window.innerHeight}px`);
        root.style.setProperty("--keyboard-height", "0px");
        root.classList.remove("keyboard-open");
        document.body.classList.remove("keyboard-open");
        return;
      }

      // Height of visual viewport (visible area above keyboard)
      const vvHeight = vv.height;
      const windowHeight = window.innerHeight;
      const offsetTop = vv.offsetTop || 0;
      const keyboardHeight = Math.max(0, windowHeight - vvHeight - offsetTop);
      const isKeyboardOpen = keyboardHeight > 80;

      root.style.setProperty("--visual-viewport-height", `${Math.round(vvHeight)}px`);
      root.style.setProperty(
        "--keyboard-height",
        `${isKeyboardOpen ? Math.round(keyboardHeight) : 0}px`
      );

      if (isKeyboardOpen) {
        root.classList.add("keyboard-open");
        document.body.classList.add("keyboard-open");
      } else {
        root.classList.remove("keyboard-open");
        document.body.classList.remove("keyboard-open");
      }
    };

    // Listen to visualViewport events
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportAndKeyboard);
      window.visualViewport.addEventListener("scroll", updateViewportAndKeyboard);
    }
    window.addEventListener("resize", updateViewportAndKeyboard);

    // Initial measurement
    updateViewportAndKeyboard();

    // Auto-scroll any focused input / textarea into the visible center of the screen
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (!isInput) return;

      const scrollToTarget = () => {
        try {
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        } catch {
          target.scrollIntoView(false);
        }
      };

      // Run multiple passes to match the virtual keyboard slide-up animation timing
      requestAnimationFrame(scrollToTarget);
      setTimeout(scrollToTarget, 100);
      setTimeout(scrollToTarget, 250);
      setTimeout(scrollToTarget, 400);
      setTimeout(scrollToTarget, 600);
    };

    document.addEventListener("focusin", handleFocusIn, { passive: true });

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportAndKeyboard);
        window.visualViewport.removeEventListener("scroll", updateViewportAndKeyboard);
      }
      window.removeEventListener("resize", updateViewportAndKeyboard);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  return <>{children}</>;
};
