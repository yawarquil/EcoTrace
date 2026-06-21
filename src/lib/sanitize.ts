/**
 * @file Input sanitization for EcoTrace.
 *
 * Applied to every piece of user-controlled text (profile name, activity note,
 * goal/challenge titles, reflection note, AI question) before it is stored or
 * interpolated into the DOM, and to every numeric input before calculation.
 * EcoTrace renders React (which auto-escapes), but these helpers add defense
 * in depth and normalize inbound data.
 */

import { clamp } from './datetime';

const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /\bon\w+\s*=/gi,
  /data:\s*text\/html/gi,
] as const;

/**
 * Sanitize a free-text value.
 *
 * Trims, strips angle brackets/backticks/quotes, neutralizes `javascript:`,
 * inline `on*=` handlers, and `data:text/html`, then truncates to `max`.
 *
 * @param value - Raw input (null/undefined tolerated).
 * @param max - Maximum retained length (default 120).
 * @returns Cleaned string, never throws.
 */
export function sanitizeText(value: unknown, max = 120): string {
  let text = String(value ?? '');
  for (const pattern of DANGEROUS_PATTERNS) {
    text = text.replace(pattern, '');
  }
  return text
    .replace(/[<>"'`]/g, '')
    .trim()
    .slice(0, max);
}

/**
 * Coerce a value to a safe number within `[min, max]`.
 *
 * @param value - Raw input.
 * @param min - Lower bound (default 0).
 * @param max - Upper bound (default max safe integer).
 * @param fallback - Returned when the input is not finite (default `min`).
 */
export function sanitizeNumber(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  fallback = min,
): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(numeric, min, max);
}

/**
 * HTML-entity-escape a string for any path that interpolates into raw markup
 * (e.g. SVG `<text>` content). React auto-escapes by default; this is the
 * explicit escape hatch used only where raw markup is unavoidable.
 */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}
