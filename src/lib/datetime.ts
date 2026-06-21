/**
 * @file Pure date and numeric helpers shared across EcoTrace.
 *
 * All functions are framework-free and deterministic given an explicit `now`.
 * They use local-time noon internally (matching the legacy product) so that a
 * date key never shifts across timezone boundaries during a single day.
 */

/** Clamp `value` into the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round to `decimals` places with floating-point epsilon correction to avoid
 * 0.1 + 0.2 style drift in displayed CO₂ figures.
 *
 * @param value - Number to round.
 * @param decimals - Decimal places (default 0).
 */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/**
 * Return a fresh Date anchored to local noon of the given date. Noon anchoring
 * prevents date-key drift when a Date is serialized/parsed across timezones.
 *
 * @param date - Reference date (defaults to now).
 */
export function startOfToday(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

/** Format a Date as a stable `YYYY-MM-DD` key (local time). */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse a `YYYY-MM-DD` key back into a noon-anchored local Date. */
export function parseDateKey(key: string): Date {
  const parts = key.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day, 12);
}

/** Return a new Date offset by `amount` days from `date`. */
export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

/** Number of days in the month of `date`. */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Seeded pseudo-random generator (mulberry32). Deterministic for a given seed
 * so the seeded leaderboard is reproducible across reloads and environments.
 *
 * @param seed - Starting 32-bit seed value.
 * @returns A function returning the next float in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed;
  return function random(): number {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
