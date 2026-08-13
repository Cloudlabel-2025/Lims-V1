"use client";

import { useEffect } from "react";

/**
 * ScreenShieldProvider — discourages casual copying and printing across every
 * page without interfering with browser inspection tools.
 *
 * Techniques used:
 *  1. Block PrintScreen, Ctrl+P, Ctrl+S, and Ctrl+U
 *  2. Clear copied page content while allowing form-field copying
 *  3. Blank the document title when the page is not visible (tab switch)
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
        // Keep browser inspection shortcuts available. Only block printing,
        // saving, and direct source viewing here.
        if (["p", "s", "u"].includes(e.key?.toLowerCase())) {
          e.preventDefault();
          return false;
        }
      }
    }

    /* ---- 2. Clear clipboard on copy ---- */
    function handleCopy(e) {
      // Allow copying inside input and textarea elements
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", "");
    }

    /* ---- 3. Visibility change — obscure title ---- */
    const originalTitle = document.title;
    function handleVisibility() {
      if (document.hidden) {
        document.title = "CHC LIMS";
      } else {
        document.title = originalTitle;
      }
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("copy", handleCopy, { capture: true });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("copy", handleCopy, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return children;
}
