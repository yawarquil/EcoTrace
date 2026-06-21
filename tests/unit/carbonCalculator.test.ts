import { describe, expect, it } from 'vitest';

import {
  addActivityEntry,
  calculateEntryCO2,
  activityReward,
  computeCarbonBudget,
  computeCarbonScore,
  computeCategoryBreakdown,
  computeLevelFromXP,
  computeScenario,
  computeStats,
  computeWeeklyData,
  entriesThisMonth,
  generateWeeklyPlan,
  getTopCategory,
  updateBudget,
} from '@/lib/carbonCalculator';
import { createInitialState } from '@/lib/initialState';
import { startOfToday, toDateKey } from '@/lib/datetime';
import type { ActivityEntry } from '@/types';

function entry(
  overrides: Partial<ActivityEntry> = {},
): ActivityEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    date: toDateKey(startOfToday()),
    category: 'Transport',
    subtype: 'Train',
    quantity: 10,
    unit: 'km',
    co2kg: 0.41,
    avoidedKg: 0,
    note: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateEntryCO2', () => {
  it('multiplies quantity by factor for petrol car', () => {
    expect(calculateEntryCO2('Transport', 'Petrol car', 100)).toMatchObject({
      co2kg: 19.2,
      unit: 'km',
    });
  });

  it('computes a beef meal at the full factor', () => {
    expect(calculateEntryCO2('Food', 'Beef meal', 1).co2kg).toBe(6.6);
  });

  it('returns factor 0 for an unknown subtype', () => {
    const impact = calculateEntryCO2('Transport', 'Teleport', 100);
    expect(impact.co2kg).toBe(0);
    expect(impact.unit).toBe('action');
  });

  it('treats NaN/negative quantity as 0', () => {
    expect(calculateEntryCO2('Transport', 'Train', Number.NaN).co2kg).toBe(0);
    expect(calculateEntryCO2('Transport', 'Train', -5).co2kg).toBe(0);
  });

  it('records avoided CO₂ for shopping subtypes', () => {
    const impact = calculateEntryCO2('Shopping', 'Repaired item', 1);
    expect(impact.co2kg).toBe(0);
    expect(impact.avoidedKg).toBe(1.8);
  });

  it('clamps absurd quantities', () => {
    const impact = calculateEntryCO2('Transport', 'Train', 1e9);
    expect(impact.co2kg).toBeGreaterThan(0);
  });
});

describe('activityReward', () => {
  it('awards 42 XP for light choices (<=2 kg)', () => {
    expect(activityReward(0)).toBe(42);
    expect(activityReward(2)).toBe(42);
  });

  it('awards 30 XP for heavier choices (>2 kg)', () => {
    expect(activityReward(2.1)).toBe(30);
    expect(activityReward(20)).toBe(30);
  });
});

describe('addActivityEntry', () => {
  it('appends a sanitized entry and awards XP', () => {
    const state = createInitialState();
    const next = addActivityEntry(state, {
      category: 'Food',
      subtype: 'Beef meal',
      quantity: 1,
    });
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]?.co2kg).toBe(6.6);
    expect(next.xp).toBe(30); // beef is heavy -> 30 XP
  });

  it('sanitizes the note and clamps quantity', () => {
    const next = addActivityEntry(createInitialState(), {
      category: 'Transport',
      subtype: 'Train',
      quantity: -5,
      note: '<script>alert(1)</script>',
    });
    expect(next.entries[0]?.quantity).toBe(0); // negative -> clamped to min 0
    // angle brackets + quotes stripped (parens/slashes kept)
    expect(next.entries[0]?.note).toBe('scriptalert(1)/script');
  });

  it('defaults unknown category to Transport', () => {
    const next = addActivityEntry(createInitialState(), {
      category: 'Bogus',
      subtype: 'Train',
      quantity: 1,
    });
    expect(next.entries[0]?.category).toBe('Transport');
  });
});

describe('computeCarbonScore', () => {
  it('returns exactly 50 on a clean first run', () => {
    expect(computeCarbonScore({ monthCO2: 0, avoidedMonth: 0, streak: 0 })).toBe(
      50,
    );
  });

  it('clamps the floor at 18 for heavy months', () => {
    expect(computeCarbonScore({ monthCO2: 1000 })).toBe(18);
  });

  it('clamps the ceiling at 100 for very clean months', () => {
    expect(
      computeCarbonScore({ monthCO2: 0, avoidedMonth: 500, streak: 30 }),
    ).toBe(100);
  });

  it('rewards streak linearly up to +10', () => {
    const withStreak = computeCarbonScore({ monthCO2: 40, streak: 22 });
    const noStreak = computeCarbonScore({ monthCO2: 40, streak: 0 });
    expect(withStreak - noStreak).toBe(10);
  });

  it('rewards avoided CO₂ at 0.2 per kg', () => {
    const score = computeCarbonScore({ monthCO2: 40, avoidedMonth: 10 });
    expect(score).toBe(Math.round(98 - 40 * 0.26 + 10 * 0.2));
  });
});

describe('computeLevelFromXP', () => {
  it('starts at level 1 with 0 XP', () => {
    const info = computeLevelFromXP(0);
    expect(info.level).toBe(1);
    expect(info.progress).toBe(0);
  });

  it('reaches Eco Hero at 1950 XP', () => {
    expect(computeLevelFromXP(1950).level).toBe(5);
  });

  it('computes progress within a level', () => {
    const info = computeLevelFromXP(480);
    // Level 2 (260..700): (480-260)/(700-260) = 50%
    expect(info.level).toBe(2);
    expect(info.progress).toBe(50);
  });

  it('handles XP far above the max level', () => {
    const info = computeLevelFromXP(100000);
    expect(info.level).toBe(5);
  });
});

describe('computeWeeklyData', () => {
  it('returns 7 weekday buckets ending today', () => {
    const data = computeWeeklyData([]);
    expect(data).toHaveLength(7);
    expect(data[6]?.date).toBe(toDateKey(startOfToday()));
  });

  it('buckets entries by date key', () => {
    const today = toDateKey(startOfToday());
    const data = computeWeeklyData([
      entry({ date: today, co2kg: 3.2 }),
      entry({ date: today, co2kg: 1.1 }),
    ]);
    expect(data[6]?.co2kg).toBe(4.3);
  });

  it('assigns the correct state band', () => {
    const today = toDateKey(startOfToday());
    const high = computeWeeklyData([entry({ date: today, co2kg: 15 })]);
    expect(high[6]?.state).toBe('high');
    const moderate = computeWeeklyData([entry({ date: today, co2kg: 7 })]);
    expect(moderate[6]?.state).toBe('moderate');
    const good = computeWeeklyData([entry({ date: today, co2kg: 2 })]);
    expect(good[6]?.state).toBe('good');
  });
});

describe('computeCategoryBreakdown', () => {
  it('returns a slice per category sorted by kg desc', () => {
    const breakdown = computeCategoryBreakdown([
      entry({ category: 'Food', co2kg: 6 }),
      entry({ category: 'Transport', co2kg: 2 }),
    ]);
    expect(breakdown[0]?.category).toBe('Food');
    expect(breakdown).toHaveLength(5);
  });

  it('handles an empty list without dividing by zero', () => {
    const breakdown = computeCategoryBreakdown([]);
    expect(breakdown.every((s) => Number.isFinite(s.percent))).toBe(true);
  });
});

describe('getTopCategory', () => {
  it('returns Transport by default with no data', () => {
    expect(getTopCategory([])).toBe('Transport');
  });

  it('returns the highest-emitting category', () => {
    expect(
      getTopCategory([
        entry({ category: 'Transport', co2kg: 1 }),
        entry({ category: 'Food', co2kg: 9 }),
      ]),
    ).toBe('Food');
  });
});

describe('generateWeeklyPlan', () => {
  it('generates 7 actions led by the top category', () => {
    const plan = generateWeeklyPlan(createInitialState(), 'Food');
    expect(plan).toHaveLength(7);
    expect(plan[0]?.category).toBe('Food');
  });

  it('marks already-completed actions done', () => {
    const state = { ...createInitialState(), completedWeeklyPlan: [] };
    const plan = generateWeeklyPlan(state, 'Transport');
    expect(plan.every((p) => p.done === false)).toBe(true);
  });
});

describe('computeStats', () => {
  it('reports a clean baseline for an empty state', () => {
    const stats = computeStats(createInitialState());
    expect(stats.monthCO2).toBe(0);
    expect(stats.hasEntries).toBe(false);
    expect(stats.carbonScore).toBe(50);
  });

  it('aggregates monthly totals from entries', () => {
    const state = {
      ...createInitialState(),
      entries: [entry({ co2kg: 5 }), entry({ co2kg: 3.5 })],
    };
    expect(computeStats(state).monthCO2).toBe(8.5);
  });
});

describe('computeCarbonBudget', () => {
  it('reports On budget when under the limit', () => {
    const stats = computeStats(createInitialState());
    const budget = computeCarbonBudget(createInitialState(), stats);
    expect(budget.status).toBe('On budget');
    expect(budget.percent).toBe(0);
  });

  it('clamps the limit floor to 40', () => {
    const state = updateBudget(createInitialState(), 5);
    const stats = computeStats(state);
    expect(computeCarbonBudget(state, stats).limit).toBe(40);
  });

  it('clamps the limit ceiling to 800', () => {
    const state = updateBudget(createInitialState(), 99999);
    const stats = computeStats(state);
    expect(computeCarbonBudget(state, stats).limit).toBe(800);
  });

  it('reports Over budget when used exceeds the limit', () => {
    const state = {
      ...createInitialState(),
      entries: [entry({ co2kg: 300 })],
    };
    const stats = computeStats(state);
    expect(computeCarbonBudget(state, stats).status).toBe('Over budget');
  });
});

describe('computeScenario', () => {
  it('returns weekly savings derived from plan actions', () => {
    const scenario = computeScenario(createInitialState());
    expect(scenario.weeklySavings).toBeGreaterThanOrEqual(0);
    expect(scenario.scoreLift).toBeGreaterThanOrEqual(1);
    expect(scenario.scoreLift).toBeLessThanOrEqual(16);
  });
});

describe('entriesThisMonth', () => {
  it('filters to the current calendar month', () => {
    const now = startOfToday();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12);
    const entries = [
      entry({ date: toDateKey(now) }),
      entry({ date: toDateKey(lastMonth) }),
    ];
    expect(entriesThisMonth(entries)).toHaveLength(1);
  });
});
