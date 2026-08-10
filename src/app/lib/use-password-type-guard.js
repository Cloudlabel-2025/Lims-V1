"use client";

import { useEffect } from "react";

export function usePasswordTypeGuard(inputRef, allowText = false) {
  useEffect(() => {
    const input = inputRef.current;
    if (!input || typeof MutationObserver === "undefined") return undefined;

    const expectedType = allowText ? "text" : "password";
    const restoreProtectedAttributes = () => {
      if (input.getAttribute("type") !== expectedType) {
        input.setAttribute("type", expectedType);
      }
      // Keep the live value in the input property without serializing it into
      // the Elements panel as a value attribute.
      if (input.hasAttribute("value")) input.removeAttribute("value");
    };

    restoreProtectedAttributes();
    const observer = new MutationObserver(restoreProtectedAttributes);
    observer.observe(input, { attributes: true, attributeFilter: ["type", "value"] });

    return () => observer.disconnect();
  }, [allowText, inputRef]);
}
