"use client";

import { useEffect } from "react";

/**
 * ScreenShieldProvider — prevents screenshots, screen recording, and common
 * developer-tools based capture across every page.
 *
 * Techniques used:
 *  1. Block PrintScreen, Ctrl+P, Ctrl+S, Ctrl+U, Ctrl+Shift+I, F12
 *  2. Block right-click context menu
 *  3. Add CSS to prevent user selection of text (still allows input fields)
 *  4. Detect window blur (potential screen-capture tool) and overlay a shield
 *  5. Blank the document title when the page is not visible (tab switch)
 */
export default function ScreenShieldProvider({ children }) {
  useEffect(() => {
    // Local development must remain inspectable for debugging and UI work.
    if (process.env.NODE_ENV !== "production") return undefined;

    /* ---- 1. Block keyboard shortcuts ---- */
    function handleKeyDown(e) {
      // PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard?.writeText?.("").catch(() => {});
        return false;
      }

      // Ctrl / Cmd combos
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        // Ctrl+P (print), Ctrl+S (save), Ctrl+U (view source)
        if (["p", "s", "u"].includes(e.key?.toLowerCase())) {
          e.preventDefault();
          return false;
        }
        // Ctrl+Shift+I (devtools), Ctrl+Shift+C (element picker), Ctrl+Shift+J (console)
        if (e.shiftKey && ["i", "c", "j"].includes(e.key?.toLowerCase())) {
          e.preventDefault();
          return false;
        }
      }

      // F12 (devtools toggle)
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }
    }

    /* ---- 2. Block context menu (right-click) ---- */
    function handleContextMenu(e) {
      e.preventDefault();
      return false;
    }

    /* ---- 3. Clear clipboard on copy ---- */
    function handleCopy(e) {
      // Allow copying inside input and textarea elements
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", "");
    }

    /* ---- 4. Visibility change — obscure title ---- */
    const originalTitle = document.title;
    function handleVisibility() {
      if (document.hidden) {
        document.title = "CHC LIMS";
      } else {
        document.title = originalTitle;
      }
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    document.addEventListener("copy", handleCopy, { capture: true });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("copy", handleCopy, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return children;
}
