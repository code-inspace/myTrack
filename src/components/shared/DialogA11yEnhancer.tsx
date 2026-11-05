"use client";

import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Full-screen overlays of the app (modals / sheets): the outermost `fixed inset-0` element. */
function isOverlay(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (!/\bfixed\b/.test(el.className) || !/\binset-0\b/.test(el.className)) return false;
  // Only overlays that hold interactive content (not decorative backdrops or the app shell)
  return el.tagName !== "BODY" && Boolean(el.querySelector(FOCUSABLE)) && el.dataset.a11yIgnore === undefined;
}

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

function labelFromHeading(dialog: HTMLElement): string | null {
  const heading = dialog.querySelector("h1, h2, h3");
  const text = heading?.textContent?.trim();
  return text || null;
}

/**
 * One place that gives every modal the dialog semantics the markup lacks, instead of editing 20
 * components: `role="dialog"` + `aria-modal` + a name taken from the first heading, focus moved
 * into the dialog and restored on close, Tab kept inside, Escape closing it through its own
 * close button, and form labels tied to their field.
 */
export const DialogA11yEnhancer: React.FC = () => {
  useEffect(() => {
    const opened = new Map<HTMLElement, HTMLElement | null>(); // dialog -> element focused before

    const enhanceDialog = (el: HTMLElement) => {
      if (opened.has(el)) return;
      if (!el.getAttribute("role")) el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
        const name = labelFromHeading(el);
        el.setAttribute("aria-label", name || "Fenêtre");
      }
      opened.set(el, document.activeElement as HTMLElement | null);
      // Don't steal focus from a field the dialog already focused itself (autoFocus)
      if (!el.contains(document.activeElement)) {
        const first = visibleFocusables(el)[0];
        if (first) first.focus({ preventScroll: true });
        else {
          el.tabIndex = -1;
          el.focus({ preventScroll: true });
        }
      }
    };

    const linkLabels = (root: ParentNode) => {
      root.querySelectorAll<HTMLLabelElement>("label:not([for])").forEach((label) => {
        if (label.querySelector("input, select, textarea")) return; // already wraps its control
        // The control that follows the label in the same container
        let control: Element | null = null;
        let sibling = label.nextElementSibling;
        for (let i = 0; sibling && i < 3 && !control; i++, sibling = sibling.nextElementSibling) {
          control = sibling.matches("input, select, textarea")
            ? sibling
            : sibling.querySelector("input:not([type=hidden]), select, textarea");
        }
        if (!control && label.parentElement) {
          control = label.parentElement.querySelector("input:not([type=hidden]), select, textarea");
        }
        if (!(control instanceof HTMLElement)) return;
        if (!control.id) control.id = `a11y-field-${Math.random().toString(36).slice(2, 9)}`;
        label.htmlFor = control.id;
      });
    };

    const scan = (root: ParentNode = document.body) => {
      root.querySelectorAll<HTMLElement>(".fixed.inset-0").forEach((el) => {
        if (isOverlay(el)) enhanceDialog(el);
      });
      linkLabels(root);
    };

    const cleanup = () => {
      for (const [dialog, previous] of Array.from(opened.entries())) {
        if (document.body.contains(dialog)) continue;
        opened.delete(dialog);
        // Give focus back to what opened the dialog
        if (previous && document.body.contains(previous)) previous.focus({ preventScroll: true });
      }
    };

    const observer = new MutationObserver((mutations) => {
      let added = false;
      for (const m of mutations) if (m.addedNodes.length) added = true;
      if (added) scan();
      cleanup();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    const topDialog = (): HTMLElement | null => {
      const list = Array.from(opened.keys()).filter((d) => document.body.contains(d));
      return list.length ? list[list.length - 1] : null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const dialog = topDialog();
      if (!dialog) return;

      if (e.key === "Tab") {
        const items = visibleFocusables(dialog);
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialog.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === "Escape" && !e.defaultPrevented) {
        // Close through the dialog's own close/cancel button (keeps each modal's save logic)
        const close = dialog.querySelector<HTMLElement>(
          '[aria-label="Fermer"], [title="Fermer"], [aria-label="Annuler"], [aria-label="Fermer la fenêtre"]',
        );
        if (close) {
          e.preventDefault();
          close.click();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
};
