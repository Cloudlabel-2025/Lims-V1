"use client";

import { useEffect } from "react";

const defaultTheme = {
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
};

export const cmsTheme = {
  primaryColor: defaultTheme.primaryColor,
  secondaryColor: defaultTheme.secondaryColor,
  accentColor: defaultTheme.accentColor,
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

function getRelativeLuminance(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(colorA, colorB) {
  const luminanceA = getRelativeLuminance(colorA);
  const luminanceB = getRelativeLuminance(colorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);

  return (lighter + 0.05) / (darker + 0.05);
}

function getReadableBrandActionColor(colors) {
  return (
    colors.find((color) => hexToRgb(color) && getContrastRatio(color, "#ffffff") >= 3) ||
    defaultTheme.primaryColor
  );
}

export function buildThemeVariables(theme) {
  const primary = theme?.primaryColor || defaultTheme.primaryColor;
  const secondary = theme?.secondaryColor || defaultTheme.secondaryColor;
  const accent = theme?.accentColor || defaultTheme.accentColor;
  const primaryIsLight = getRelativeLuminance(primary) > 0.62;
  const accentIsLight = getRelativeLuminance(accent) > 0.78;
  const onPrimary = primaryIsLight ? "#0f172a" : "#ffffff";
  const onPrimaryMuted = primaryIsLight ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.75)";
  const onPrimarySubtle = primaryIsLight ? "rgba(15, 23, 42, 0.18)" : "rgba(255, 255, 255, 0.25)";
  const actionColor = getReadableBrandActionColor([accent, primary, secondary]);
  const loginBrandBorder = primaryIsLight ? "rgba(15, 23, 42, 0.12)" : "transparent";
  const loginBrandShadow = primaryIsLight ? "inset -1px 0 0 rgba(15, 23, 42, 0.08)" : "none";

  return {
    "--primary": primary,
    "--primary-50": mixColors(primary, "#ffffff", 0.94),
    "--primary-100": mixColors(primary, "#ffffff", 0.84),
    "--primary-200": mixColors(primary, "#ffffff", 0.68),
    "--primary-600": primary,
    "--primary-dark": secondary,
    "--primary-700": secondary,
    "--primary-800": mixColors(secondary, "#000000", 0.18),
    "--primary-light": accent,
    "--login-accent": accent,
    "--on-primary": onPrimary,
    "--on-primary-muted": onPrimaryMuted,
    "--on-primary-subtle": onPrimarySubtle,
    "--brand-action": actionColor,
    "--login-action": actionColor,
    "--login-brand-bg": primary,
    "--login-brand-border": loginBrandBorder,
    "--login-brand-shadow": loginBrandShadow,
    "--login-button-bg": primaryIsLight ? actionColor : primary,
    "--login-button-text": primaryIsLight ? "#ffffff" : onPrimary,
    "--login-feature-dot": accentIsLight ? actionColor : accent,
  };
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const variables = buildThemeVariables(theme);

  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function applyCmsTheme() {
  applyTheme(cmsTheme);
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
