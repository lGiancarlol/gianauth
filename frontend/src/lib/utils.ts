import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a hex color (#RGB or #RRGGBB) into [r, g, b] 0-255.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  const full  = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const n = parseInt(full, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Relative luminance (WCAG 2.1).
 */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Returns true if the color has enough contrast to be used as an accent
 * on a dark background (luminance > 0.04 — avoids near-black colors).
 */
export function isAccentSafe(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return luminance(...rgb) > 0.04;
}

/** Default accent when no custom color is set. */
const DEFAULT_ACCENT = "#c0392b";

/**
 * Builds the full theme CSS variable set from a hex accent color and injects
 * it into :root. Every component reads var(--theme-*) — no prop drilling.
 *
 * Variables injected:
 *   --theme-primary      raw hex
 *   --theme-rgb          "r g b" for rgba() composition
 *   --theme-soft         4% bg  (subtle tint)
 *   --theme-muted        8% bg  (card hover, unread bg)
 *   --theme-hover        14% bg (button/row hover)
 *   --theme-border       22% border
 *   --theme-glow         box-shadow glow string
 *   --theme-fg           foreground on solid accent bg
 *
 * Legacy --accent-* aliases kept for backward compat with Sidebar.
 */
export function applyAccentTheme(hex: string | null | undefined): void {
  const root   = document.documentElement;
  const color  = (hex && isAccentSafe(hex)) ? hex : DEFAULT_ACCENT;
  const rgb    = hexToRgb(color)!;
  const [r, g, b] = rgb;
  const lum    = luminance(r, g, b);
  const fg     = lum > 0.4 ? "#0f172a" : "#ffffff";

  // Theme variables
  root.style.setProperty("--theme-primary", color);
  root.style.setProperty("--theme-rgb",     `${r},${g},${b}`);
  root.style.setProperty("--theme-soft",    `rgba(${r},${g},${b},0.06)`);
  root.style.setProperty("--theme-muted",   `rgba(${r},${g},${b},0.10)`);
  root.style.setProperty("--theme-hover",   `rgba(${r},${g},${b},0.15)`);
  root.style.setProperty("--theme-border",  `rgba(${r},${g},${b},0.28)`);
  root.style.setProperty("--theme-glow",    `0 0 0 3px rgba(${r},${g},${b},0.18)`);
  root.style.setProperty("--theme-fg",      fg);

  // Legacy aliases (Sidebar uses these)
  root.style.setProperty("--accent-hex",    color);
  root.style.setProperty("--accent-rgb",    `${r} ${g} ${b}`);
  root.style.setProperty("--accent-soft",   `rgba(${r},${g},${b},0.08)`);
  root.style.setProperty("--accent-muted",  `rgba(${r},${g},${b},0.12)`);
  root.style.setProperty("--accent-hover",  `rgba(${r},${g},${b},0.16)`);
  root.style.setProperty("--accent-border", `rgba(${r},${g},${b},0.25)`);
  root.style.setProperty("--accent-fg",     fg);
}

/**
 * Inline style helper — returns a style object using theme CSS vars.
 * Use when Tailwind can't reference dynamic CSS vars directly.
 *
 * @example
 * <button style={themeStyle("bg")}> → background: var(--theme-primary)
 * <div style={themeStyle("border")}> → borderColor: var(--theme-border)
 */
export function themeStyle(type: "bg" | "border" | "text" | "glow" | "soft" | "muted" | "hover") {
  switch (type) {
    case "bg":     return { background:   "var(--theme-primary)",  color: "var(--theme-fg)" };
    case "border": return { borderColor:  "var(--theme-border)" };
    case "text":   return { color:        "var(--theme-primary)" };
    case "glow":   return { boxShadow:    "var(--theme-glow)" };
    case "soft":   return { background:   "var(--theme-soft)" };
    case "muted":  return { background:   "var(--theme-muted)" };
    case "hover":  return { background:   "var(--theme-hover)" };
  }
}

/**
 * Returns days until a date (negative = overdue).
 */
export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
