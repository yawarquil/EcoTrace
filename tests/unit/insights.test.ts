import { describe, expect, it } from 'vitest';

import {
  generateInsightCards,
  insightSummary,
  reductionOpportunities,
} from '@/lib/insights';
import { computeStats } from '@/lib/carbonCalculator';
import { createInitialState } from '@/lib/initialState';
import { toDateKey, startOfToday } from '@/lib/datetime';
import type { ActivityEntry } from '@/types';

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    date: toDateKey(startOfToday()),
    category: 'Transport',
    subtype: 'Train',
    quantity: 10,
    unit: 'km',
    co2kg: 5,
    avoidedKg: 0,
    note: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('generateInsightCards', () => {
  it('returns a single first-signal card when there are no entries', () => {
    const state = createInitialState();
    const cards = generateInsightCards(state, computeStats(state));
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe('Build your first signal');
    expect(cards[0]?.confidence).toBe('Low');
  });

  it('leads with the top category as the priority lever', () => {
    const state = {
      ...createInitialState(),
      entries: [
        entry({ category: 'Food', co2kg: 12 }),
        entry({ category: 'Transport', co2kg: 2 }),
      ],
    };
    const cards = generateInsightCards(state, computeStats(state));
    expect(cards[0]?.type).toBe('Priority lever');
    expect(cards[0]?.title).toContain('food');
  });

  it('includes a habit-loop card when streak >= 3', () => {
    const state = {
      ...createInitialState(),
      entries: [
        entry({ date: '2024-01-01', co2kg: 2 }),
        entry({ date: '2024-01-02', co2kg: 2 }),
        entry({ date: '2024-01-03', co2kg: 2 }),
      ],
    };
    const cards = generateInsightCards(state, computeStats(state));
    expect(cards.some((c) => c.type === 'Habit loop')).toBe(true);
  });

  it('caps the output at 3 cards', () => {
    const state = {
      ...createInitialState(),
      entries: [
        entry({ co2kg: 5, avoidedKg: 4 }),
        entry({ co2kg: 5, avoidedKg: 4 }),
      ],
    };
    const cards = generateInsightCards(state, computeStats(state));
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('reports High confidence with >= 5 entries', () => {
    const state = {
      ...createInitialState(),
      entries: Array.from({ length: 6 }, () => entry({ co2kg: 1 })),
    };
    const cards = generateInsightCards(state, computeStats(state));
    expect(cards[0]?.confidence).toBe('High');
  });
});

describe('insightSummary', () => {
  it('mentions the first activity for an empty state', () => {
    const state = createInitialState();
    expect(insightSummary(state, computeStats(state))).toContain('first activity');
  });

  it('names the strongest signal for a populated state', () => {
    const state = {
      ...createInitialState(),
      entries: [entry({ category: 'Food', co2kg: 8 })],
    };
    expect(insightSummary(state, computeStats(state))).toContain('food');
  });
});

describe('reductionOpportunities', () => {
  it('returns nothing for an empty entry list', () => {
    expect(reductionOpportunities([], [])).toEqual([]);
  });

  it('targets a quarter of each category footprint', () => {
    const breakdown = [
      { category: 'Food', kg: 12, percent: 60 },
      { category: 'Transport', kg: 4, percent: 40 },
    ] as never;
    const opps = reductionOpportunities(breakdown, [entry({})]);
    expect(opps[0]?.potentialKg).toBe(3); // 25% of 12
    expect(opps[1]?.potentialKg).toBe(1); // 25% of 4
  });
});
