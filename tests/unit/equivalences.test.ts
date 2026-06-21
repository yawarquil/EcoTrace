import { describe, expect, it } from 'vitest';

import { buildEquivalences, entryEquivalence, totalEntriesCO2 } from '@/lib/equivalences';
import { toDateKey, startOfToday } from '@/lib/datetime';
import type { ActivityEntry } from '@/types';

function entry(co2kg: number): ActivityEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    date: toDateKey(startOfToday()),
    category: 'Transport',
    subtype: 'Train',
    quantity: 1,
    unit: 'km',
    co2kg,
    avoidedKg: 0,
    note: '',
    timestamp: new Date().toISOString(),
  };
}

describe('buildEquivalences', () => {
  it('returns nothing for zero CO₂', () => {
    expect(buildEquivalences(0)).toEqual([]);
  });

  it('returns up to 3 equivalences for a real month', () => {
    const eq = buildEquivalences(50);
    expect(eq.length).toBeLessThanOrEqual(3);
    expect(eq.every((e) => e.count >= 1)).toBe(true);
  });

  it('rotates the set based on the seed offset', () => {
    const a = buildEquivalences(50, 0);
    const b = buildEquivalences(50, 1);
    expect(a[0]?.id).not.toBe(b[0]?.id);
  });

  it('computes coffee count from the factor', () => {
    const eq = buildEquivalences(2.8, 0);
    const coffee = eq.find((e) => e.id === 'coffeeCup');
    if (coffee) {
      expect(coffee.count).toBe(10); // 2.8 / 0.28
    }
  });
});

describe('entryEquivalence', () => {
  it('returns null for zero CO₂', () => {
    expect(entryEquivalence(0)).toBeNull();
  });

  it('returns a coffee comparison for a single entry', () => {
    const eq = entryEquivalence(6.6);
    expect(eq?.id).toBe('coffeeCup');
    expect(eq?.count).toBe(Math.round(6.6 / 0.28));
  });
});

describe('totalEntriesCO2', () => {
  it('sums entry CO₂', () => {
    expect(totalEntriesCO2([entry(5), entry(3.2)])).toBe(8.2);
  });
});
