import { useEffect } from "react";

/**
 * useKeyboardScroll — fix the iOS Safari "keyboard hides the input" problem.
 * ────────────────────────────────────────────────────────────────────────────
 *  On iOS, the on-screen keyboard slides in over the page WITHOUT reflowing
 *  the viewport — so any text field that happened to be near the lower half
 *  of the screen ends up completely hidden under the keyboard, and the user
 *  has to manually scroll the page just to see what they're typing.
 *
 *  This hook installs a single `focusin` listener on `document` that:
 *    1. detects when a form control (input / textarea / select / contenteditable)
 *       receives focus,
 *    2. waits ~320 ms for the iOS keyboard animation to complete,
 *    3. scrolls the focused element to the centre of the visible viewport via
 *       `scrollIntoView({ block: "center" })`.
 *
 *  Why `block: "center"` instead of `"start"`?
 *    Centre placement leaves room both above and below the input — useful for
 *    forms where surrounding context (labels, helper text, validation errors)
 *    should remain visible. With `"start"` the input would hug the top edge
 *    of the viewport and any label above it would scroll off-screen.
 *
 *  Why a `setTimeout` instead of `requestAnimationFrame`?
 *    The iOS keyboard takes 200–300 ms to slide in. If we scroll before then,
 *    the viewport height we read is wrong (it's still the full screen) and
 *    the input lands too low. Waiting ~320 ms ensures we measure against the
 *    *shrunken* viewport.
 *
 *  Why also listen to `visualViewport.resize`?
 *    On some Android browsers (and on iPadOS in some app contexts) the
 *    keyboard appears AFTER focus — sometimes hundreds of ms later. The
 *    visualViewport resize event fires the moment the keyboard finishes
 *    animating in, regardless of timing. We re-scroll on that signal too,
 *    making the fix robust across browsers.
 *
 *  Cleanup is automatic on unmount — no leaks.
 */
export default function useKeyboardScroll() {
  useEffect(() => {
    // Only apply on touch devices. On desktop, focusing an input never hides
    // it behind a virtual keyboard, so scrolling would just be visual noise.
    const isTouch =
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
    if (!isTouch) return;

    const KEYBOARD_OPEN_DELAY = 320; // ms — covers the iOS keyboard animation
    const SELECTOR = 'input, textarea, select, [contenteditable="true"]';

    // Filter out inputs that shouldn't trigger a scroll (radios, checkboxes,
    // hidden, file pickers — none of these summon a keyboard).
    const SKIP_INPUT_TYPES = new Set([
      "checkbox", "radio", "hidden", "file", "button", "submit", "reset", "image",
    ]);

    const isScrollableField = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (!el.matches(SELECTOR)) return false;
      if (el.tagName === "INPUT" && SKIP_INPUT_TYPES.has(el.type)) return false;
      return true;
    };

    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (!isScrollableField(el)) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      } catch {
        // Older browsers don't support the options object — fall back to legacy form.
        el.scrollIntoView();
      }
    };

    const onFocusIn = (e) => {
      if (!isScrollableField(e.target)) return;
      // Wait for the soft-keyboard slide-in to settle, then scroll.
      setTimeout(scrollFocusedIntoView, KEYBOARD_OPEN_DELAY);
    };

    document.addEventListener("focusin", onFocusIn);

    // Visual Viewport API — re-scroll when the keyboard actually finishes
    // animating in. This catches Android browsers where the keyboard appears
    // later than our setTimeout assumes.
    const vv = window.visualViewport;
    let lastHeight = vv?.height ?? window.innerHeight;
    const onViewportResize = () => {
      const next = vv?.height ?? window.innerHeight;
      // Viewport shrunk — keyboard probably just opened.
      if (next < lastHeight - 100) scrollFocusedIntoView();
      lastHeight = next;
    };
    vv?.addEventListener?.("resize", onViewportResize);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      vv?.removeEventListener?.("resize", onViewportResize);
    };
  }, []);
}
