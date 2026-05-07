"use client";

import { useEffect } from "react";

const defaultTheme = {
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
};

function applyTheme(theme) {
  const root = document.documentElement;
  const primary = theme?.primaryColor || defaultTheme.primaryColor;
  const secondary = theme?.secondaryColor || defaultTheme.secondaryColor;
  const accent = theme?.accentColor || defaultTheme.accentColor;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-600", primary);
  root.style.setProperty("--primary-dark", secondary);
  root.style.setProperty("--primary-700", secondary);
  root.style.setProperty("--primary-light", accent);
}

export default function ThemeProvider({ children }) {
  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      try {
        const response = await fetch("/api/theme", { credentials: "include" });
        const data = await response.json();
        if (!cancelled && response.ok) {
          applyTheme(data.theme);
        }
      } catch {
        if (!cancelled) applyTheme(defaultTheme);
      }
    }

    loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
