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

/**
 * Builds a set of CSS custom properties from a hex accent color.
 * Injects them into document.documentElement so every component
 * can reference var(--accent-*) without prop drilling.
 *
 * Variables injected:
 *   --accent-hex        raw hex value
 *   --accent-rgb        "r g b" for use in rgba()
 *   --accent-soft       8% opacity background
 *   --accent-muted      12% opacity background
 *   --accent-hover      16% opacity background
 *   --accent-border     25% opacity border
 *   --accent-fg         foreground color (white or dark) for contrast
 */
export function applyAccentTheme(hex: string | null | undefined): void {
  const root = document.documentElement;

  if (!hex || !isAccentSafe(hex)) {
    // Remove overrides — fall back to Tailwind primary
    root.style.removeProperty("--accent-hex");
    root.style.removeProperty("--accent-rgb");
    root.style.removeProperty("--accent-soft");
    root.style.removeProperty("--accent-muted");
    root.style.removeProperty("--accent-hover");
    root.style.removeProperty("--accent-border");
    root.style.removeProperty("--accent-fg");
    return;
  }

  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [r, g, b] = rgb;
  const lum = luminance(r, g, b);

  root.style.setProperty("--accent-hex",    hex);
  root.style.setProperty("--accent-rgb",    `${r} ${g} ${b}`);
  root.style.setProperty("--accent-soft",   `rgba(${r},${g},${b},0.08)`);
  root.style.setProperty("--accent-muted",  `rgba(${r},${g},${b},0.12)`);
  root.style.setProperty("--accent-hover",  `rgba(${r},${g},${b},0.16)`);
  root.style.setProperty("--accent-border", `rgba(${r},${g},${b},0.25)`);
  // Foreground: white on dark accents, near-black on light ones
  root.style.setProperty("--accent-fg",     lum > 0.4 ? "#0f172a" : "#ffffff");
}

/**
 * Returns days until a date (negative = overdue).
 */
export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
