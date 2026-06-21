import { describe, expect, it } from 'vitest';

import {
  addDays,
  clamp,
  daysInMonth,
  mulberry32,
  parseDateKey,
  round,
  startOfToday,
  toDateKey,
} from '@/lib/datetime';

describe('clamp', () => {
  it('clamps within range and to bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('round', () => {
  it('rounds to the given decimals with epsilon correction', () => {
    expect(round(0.1 + 0.2, 1)).toBe(0.3);
    expect(round(2.5)).toBe(3);
    expect(round(2.467, 2)).toBe(2.47);
  });
});

describe('startOfToday / toDateKey', () => {
  it('anchors to local noon', () => {
    const d = startOfToday(new Date(2024, 0, 15, 3, 30));
    expect(d.getHours()).toBe(12);
    expect(toDateKey(d)).toBe('2024-01-15');
  });

  it('zero-pads month and day', () => {
    expect(toDateKey(new Date(2024, 2, 5, 12))).toBe('2024-03-05');
  });
});

describe('parseDateKey', () => {
  it('round-trips a YYYY-MM-DD key', () => {
    const d = parseDateKey('2024-07-09');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(6); // July (0-indexed)
    expect(d.getDate()).toBe(9);
  });

  it('returns an invalid date for a malformed key', () => {
    expect(Number.isNaN(parseDateKey('nope').getTime())).toBe(true);
  });
});

describe('addDays', () => {
  it('offsets forward and backward across month boundaries', () => {
    const base = new Date(2024, 0, 31, 12);
    expect(toDateKey(addDays(base, 1))).toBe('2024-02-01');
    expect(toDateKey(addDays(base, -31))).toBe('2023-12-31');
  });
});

describe('daysInMonth', () => {
  it('knows February in a leap year', () => {
    expect(daysInMonth(new Date(2024, 1, 10))).toBe(29);
    expect(daysInMonth(new Date(2023, 1, 10))).toBe(28);
  });

  it('knows April has 30 days', () => {
    expect(daysInMonth(new Date(2024, 3, 1))).toBe(30);
  });
});

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces floats in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('advances state across calls', () => {
    const rng = mulberry32(1);
    const first = rng();
    const second = rng();
    expect(first).not.toBe(second);
  });
});
