import { describe, expect, it } from 'vitest';

import {
  buildLeaderboard,
  computeAchievements,
  computeBadges,
  computeStreak,
  cleanProfileName,
  LEADERBOARD_NAMES,
  nextLevel,
  planActionReward,
} from '@/lib/gamification';
import { createInitialState } from '@/lib/initialState';
import { toDateKey, startOfToday } from '@/lib/datetime';
import type { ActivityEntry } from '@/types';

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    date: toDateKey(startOfToday()),
    category: 'Transport',
    subtype: 'Train',
    quantity: 1,
    unit: 'km',
    co2kg: 0.04,
    avoidedKg: 0,
    note: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('cleanProfileName', () => {
  it('falls back to EcoTrace User for empty input', () => {
    expect(cleanProfileName('')).toBe('EcoTrace User');
    expect(cleanProfileName('   ')).toBe('EcoTrace User');
  });

  it('strips dangerous characters', () => {
    expect(cleanProfileName('<script>')).toBe('script');
  });
});

describe('computeStreak', () => {
  it('counts distinct logging days, capped at 30', () => {
    expect(computeStreak([])).toBe(0);
    expect(computeStreak([entry({ date: '2024-01-01' })])).toBe(1);
    expect(computeStreak(Array.from({ length: 40 }, (_, i) =>
      entry({ date: `2024-01-${String(i + 1).padStart(2, '0')}` }),
    ))).toBe(30);
  });
});

describe('planActionReward', () => {
  it('awards 26 XP for high-impact actions', () => {
    expect(planActionReward(5)).toBe(26);
  });

  it('awards 18 XP for smaller-impact actions', () => {
    expect(planActionReward(1)).toBe(18);
  });
});

describe('computeBadges', () => {
  it('starts with nothing unlocked', () => {
    const badges = computeBadges(createInitialState());
    expect(badges.every((b) => !b.unlocked)).toBe(true);
  });

  it('unlocks First Signal after one entry', () => {
    const badges = computeBadges({
      ...createInitialState(),
      entries: [entry({})],
    });
    expect(badges.find((b) => b.id === 'first-signal')?.unlocked).toBe(true);
  });

  it('unlocks level 3 badge at 700 XP', () => {
    const badges = computeBadges({ ...createInitialState(), xp: 700 });
    expect(badges.find((b) => b.id === 'level-3')?.unlocked).toBe(true);
  });
});

describe('computeAchievements', () => {
  it('reports progress as a 0..100 percentage', () => {
    const ach = computeAchievements(createInitialState());
    expect(ach.every((a) => a.progress >= 0 && a.progress <= 100)).toBe(true);
    expect(ach.every((a) => !a.complete)).toBe(true);
  });

  it('completes the eco-hero achievement at 1950 XP', () => {
    const ach = computeAchievements({ ...createInitialState(), xp: 1950 });
    expect(ach.find((a) => a.id === 'eco-hero')?.complete).toBe(true);
  });
});

describe('buildLeaderboard', () => {
  it('produces exactly 16 rows including You', () => {
    const board = buildLeaderboard(500);
    expect(board).toHaveLength(16);
    expect(board.some((r) => r.isYou)).toBe(true);
  });

  it('preserves all 16 canonical names', () => {
    const board = buildLeaderboard(0);
    const names = new Set(board.map((r) => r.name));
    for (const name of LEADERBOARD_NAMES) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('is deterministic across calls with the same XP', () => {
    const a = buildLeaderboard(123);
    const b = buildLeaderboard(123);
    expect(a).toEqual(b);
  });

  it('assigns gold/silver/bronze to the top three', () => {
    const board = buildLeaderboard(5000); // You at the top
    expect(board[0]?.medal).toBe('gold');
    expect(board[1]?.medal).toBe('silver');
    expect(board[2]?.medal).toBe('bronze');
  });

  it('sorts by XP descending', () => {
    const board = buildLeaderboard(500);
    const xps = board.map((r) => r.xp);
    const sorted = [...xps].sort((a, b) => b - a);
    expect(xps).toEqual(sorted);
  });
});

describe('nextLevel', () => {
  it('returns the next threshold above current XP', () => {
    expect(nextLevel(0)?.level).toBe(2);
    expect(nextLevel(300)?.level).toBe(3);
  });

  it('returns null at max level', () => {
    expect(nextLevel(5000)).toBeNull();
  });
});
