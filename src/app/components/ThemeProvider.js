"use client";

import { useEffect } from "react";

const defaultTheme = {
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
};

function hexToRgb(hex) {
  const normalized = String(hex || "").trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(value)) return null;

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColors(baseColor, mixColor, weight) {
  const base = hexToRgb(baseColor);
  const mix = hexToRgb(mixColor);

  if (!base || !mix) return baseColor;

  return rgbToHex({
    r: base.r * (1 - weight) + mix.r * weight,
    g: base.g * (1 - weight) + mix.g * weight,
    b: base.b * (1 - weight) + mix.b * weight,
  });
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const primary = theme?.primaryColor || defaultTheme.primaryColor;
  const secondary = theme?.secondaryColor || defaultTheme.secondaryColor;
  const accent = theme?.accentColor || defaultTheme.accentColor;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-50", mixColors(primary, "#ffffff", 0.94));
  root.style.setProperty("--primary-100", mixColors(primary, "#ffffff", 0.84));
  root.style.setProperty("--primary-200", mixColors(primary, "#ffffff", 0.68));
  root.style.setProperty("--primary-600", primary);
  root.style.setProperty("--primary-dark", secondary);
  root.style.setProperty("--primary-700", secondary);
  root.style.setProperty("--primary-800", mixColors(secondary, "#000000", 0.18));
  root.style.setProperty("--primary-light", accent);
  root.style.setProperty("--login-accent", accent);
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
