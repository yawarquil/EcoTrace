import { describe, expect, it } from 'vitest';

import { selectNudge } from '@/lib/nudgeEngine';

describe('selectNudge', () => {
  it('returns null for zero quantity', () => {
    expect(
      selectNudge({ category: 'Food', subtype: 'Beef meal', quantity: 0 }),
    ).toBeNull();
  });

  it('suggests a vegetarian swap for beef with a kg delta', () => {
    const nudge = selectNudge({
      category: 'Food',
      subtype: 'Beef meal',
      quantity: 1,
    });
    expect(nudge).not.toBeNull();
    expect(nudge?.betterSubtype).toBe('Vegetarian meal');
    // (6.61 - 0.64) * 1 = 5.97 -> rounds to 6.0
    expect(nudge?.savingKg).toBe(6);
  });

  it('quantifies the saving per quantity for petrol car -> train', () => {
    const nudge = selectNudge({
      category: 'Transport',
      subtype: 'Petrol car',
      quantity: 100,
    });
    expect(nudge?.betterSubtype).toBe('Train');
    // (0.192 - 0.041) * 100 = 15.1
    expect(nudge?.savingKg).toBe(15.1);
  });

  it('falls back to a high-impact framing when no swap is meaningful', () => {
    const nudge = selectNudge({
      category: 'Home Energy',
      subtype: 'Natural gas',
      quantity: 1,
    });
    expect(nudge).not.toBeNull();
    expect(nudge?.title).toBe('High-impact choice');
    expect(nudge?.savingKg).toBe(0);
  });

  it('returns null for an unknown low-impact subtype', () => {
    expect(
      selectNudge({ category: 'Travel', subtype: 'Rail planning', quantity: 1 }),
    ).toBeNull();
  });

  it('clamps negative quantity to null', () => {
    expect(
      selectNudge({ category: 'Food', subtype: 'Beef meal', quantity: -5 }),
    ).toBeNull();
  });
});
